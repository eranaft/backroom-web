const statusEl = document.getElementById('status');
const timerEl = document.getElementById('timer');
const metaEl = document.getElementById('meta');
const wrapEl = document.getElementById('wrap');

const canvas = document.getElementById('stars');
const ctx = canvas.getContext('2d', { alpha: true });

function fmt(ms){
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

let lastState = { open:false, openUntil:0, now:Date.now() };

function apiBase(){
  return (window.API_BASE || '').trim().replace(/\/+$/, '');
}

/**
 * Ожидаем от Cloudflare Worker:
 * GET /lobby -> { open:boolean, openUntil:number, now:number }
 */
async function fetchLobby(){
  const base = apiBase();
  const r = await fetch(`${base}/lobby`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status} /lobby`);
  const j = await r.json();
  // защита от кривого формата
  return {
    open: !!j.open,
    openUntil: Number(j.openUntil || 0),
    now: Number(j.now || Date.now()),
  };
}

function render(st){
  lastState = st;

  document.body.classList.toggle('is-closed', !st.open);

  if (st.open){
    statusEl.textContent = 'OPEN';
    statusEl.classList.remove('closed');
    statusEl.classList.add('open');
    statusEl.setAttribute('aria-disabled', 'false');
    timerEl.textContent = '';
  } else {
    statusEl.textContent = 'CLOSED';
    statusEl.classList.remove('open');
    statusEl.classList.add('closed');
    statusEl.setAttribute('aria-disabled', 'true');

    // когда закрыто, если openUntil в будущем — показываем таймер
    if (st.openUntil && st.openUntil > Date.now()){
      timerEl.textContent = fmt(st.openUntil - Date.now());
    } else {
      timerEl.textContent = '';
    }
  }

  // мета — без windowId
  metaEl.textContent = `lobby: ${st.open ? 'OPEN' : 'CLOSED'}`;
}

async function tick(){
  try{
    const st = await fetchLobby();
    render(st);
  }catch(e){
    metaEl.textContent = `offline: ${String(e.message || e)}`;
  }
}

/* ======================
   Плавное включение эффектов
   ====================== */
const isTouchDevice = matchMedia('(pointer: coarse)').matches;

let targetEngage = 0;  // 0..1 (хочу включить)
let engage = 0;        // 0..1 (плавно включилось)

let hold = 0;          // 0..1.6 (для “ускорения со временем”)
let warp = 0;          // 0..1 (главный множитель)
let tiltX = 0, tiltY = 0;
let lastTs = performance.now();

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function smoothstep(t){ return t * t * (3 - 2 * t); }

function setVars(){
  document.body.style.setProperty('--warp', warp.toFixed(3));

  // фон: ускорение мягкое и медленное
  const baseSpeed = (lastState?.open ? 28 : 34);
  const minSpeed  = (lastState?.open ? 18 : 30);
  const s = baseSpeed - (baseSpeed - minSpeed) * clamp(warp, 0, 1);
  document.body.style.setProperty('--bgSpeed', `${s.toFixed(2)}s`);

  // hue тоже мягко
  const hue = (lastState?.open ? (warp * 80) : 0);
  document.body.style.setProperty('--bgHue', `${hue.toFixed(1)}deg`);

  // наклон: только в engage
  document.body.style.setProperty('--tiltX', `${tiltX.toFixed(2)}deg`);
  document.body.style.setProperty('--tiltY', `${tiltY.toFixed(2)}deg`);

  // мягкое усиление свечения текста
  const glow = 0.10 + 0.08 * warp;
  document.body.style.setProperty('--textGlow', glow.toFixed(3));
}

/* ======================
   ПК: эффекты только при наведении на OPEN
   Мобилка: эффекты при движении пальцем по экрану (если OPEN)
   ====================== */
function enterFromOpen(){
  if (lastState?.open) targetEngage = 1;
}
function leaveFromOpen(){
  targetEngage = 0;
}

statusEl.addEventListener('mouseenter', () => {
  if (!isTouchDevice) enterFromOpen();
});
statusEl.addEventListener('mouseleave', () => {
  if (!isTouchDevice) leaveFromOpen();
});

// Tap по OPEN (мобилка): включаем, пока держит палец
statusEl.addEventListener('touchstart', enterFromOpen, { passive:true });
statusEl.addEventListener('touchend', leaveFromOpen, { passive:true });
statusEl.addEventListener('touchcancel', leaveFromOpen, { passive:true });

/* tilt: на ПК только когда навёл OPEN; на мобиле — когда водит пальцем */
function applyPointerTilt(x, y){
  const r = wrapEl.getBoundingClientRect();
  const nx = (x - (r.left + r.width/2)) / (r.width/2);
  const ny = (y - (r.top + r.height/2)) / (r.height/2);

  tiltY = clamp(nx, -1, 1) * 6;
  tiltX = clamp(-ny, -1, 1) * 4;
}

window.addEventListener('mousemove', (e) => {
  if (isTouchDevice) return;
  if (targetEngage < 0.5) return;
  applyPointerTilt(e.clientX, e.clientY);
}, { passive:true });

window.addEventListener('touchmove', (e) => {
  const t = e.touches?.[0];
  if (!t) return;

  // Мобилка: если OPEN, то движение пальца включает эффекты везде
  if (lastState?.open) targetEngage = 1;

  applyPointerTilt(t.clientX, t.clientY);
}, { passive:true });

// отпустил палец — выключаем
document.body.addEventListener('touchend', () => {
  targetEngage = 0;
}, { passive:true });

document.body.addEventListener('touchcancel', () => {
  targetEngage = 0;
}, { passive:true });

/* ======================
   Canvas stars
   ====================== */
let W=0, H=0, DPR=1;
let stars = [];

function resize(){
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = Math.floor(window.innerWidth);
  H = Math.floor(window.innerHeight);

  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  const count = Math.floor((W * H) / 12000);
  stars = new Array(count).fill(0).map(() => ({
    x: Math.random()*W,
    y: Math.random()*H,
    r: 0.6 + Math.random()*1.5,
    a: 0.10 + Math.random()*0.45,
    vx: 0.18 + Math.random()*0.10,
    vy: -0.06 + Math.random()*0.12,
    tw: 0.45 + Math.random()*1.1,
    ph: Math.random()*Math.PI*2
  }));
}
window.addEventListener('resize', resize);
resize();

function drawStars(ts){
  ctx.clearRect(0, 0, W, H);

  const open = !!lastState?.open;

  const baseSpeed = open ? 0.32 : 0.14;
  const speed = baseSpeed + (open ? (engage * (0.55 + warp*0.55)) : 0);

  const twMul = open ? 1.0 : 0.55;

  for (const s of stars){
    s.x += s.vx * speed;
    s.y += s.vy * speed;

    if (s.x > W + 10) s.x = -10;
    if (s.x < -10) s.x = W + 10;
    if (s.y > H + 10) s.y = -10;
    if (s.y < -10) s.y = H + 10;

    const tw = (Math.sin(ts*0.001*s.tw*twMul + s.ph) + 1) * 0.5;
    const alpha = s.a * (0.62 + tw*0.38);

    const glow = open
      ? `rgba(88,242,255,${alpha*0.08})`
      : `rgba(255,110,120,${alpha*0.05})`;

    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
    ctx.fill();

    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r*2.8, 0, Math.PI*2);
    ctx.fill();
  }
}

/* ======================
   Переход в комнату: без пятна
   ====================== */
let jumping = false;

statusEl.addEventListener('click', () => {
  if (!lastState?.open || jumping) return;

  jumping = true;
  targetEngage = 1;
  hold = 1.6;
  warp = 1;

  setTimeout(() => {
    location.href = '/room.html';
  }, 420);
});

/* ======================
   Main loop
   ====================== */
function frame(ts){
  const dt = Math.min(0.05, (ts - lastTs)/1000);
  lastTs = ts;

  const open = !!lastState?.open;

  engage += (targetEngage - engage) * 0.08;

  const engaged = open && engage > 0.02;

  if (engaged) hold = clamp(hold + dt*0.95, 0, 1.6);
  else hold = clamp(hold - dt*1.35, 0, 1.6);

  const t = smoothstep(hold/1.6);

  const targetWarp = open ? clamp(0.05 + 0.75*t, 0, 1) * engage : 0;
  warp += (targetWarp - warp) * 0.07;

  if (!engaged){
    tiltX *= 0.85;
    tiltY *= 0.85;
  }

  setVars();
  drawStars(ts);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// раз в 5 сек подтягиваем состояние с воркера
tick();
setInterval(tick, 5000);

// таймер обновляем раз в 1 сек, чтобы был плавный
setInterval(() => {
  if (!lastState?.open && lastState?.openUntil > Date.now()) {
    timerEl.textContent = fmt(lastState.openUntil - Date.now());
  }
}, 1000);