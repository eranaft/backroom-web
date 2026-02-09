const statusEl = document.getElementById('status');
const timerEl = document.getElementById('timer');
const metaEl = document.getElementById('meta');
const wrapEl = document.getElementById('wrap');

const canvas = document.getElementById('stars');
const ctx = canvas.getContext('2d', { alpha: true });

function apiBase() {
  return (window.API_BASE || '').trim().replace(/\/+$/, '');
}

function fmt(ms){
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

let lastState = { isOpen:false, openUntil:0, now:Date.now(), windowId:"CLOSED" };

async function fetchState(){
  const base = apiBase();
  const r = await fetch(`${base}/state`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status} /state`);
  return r.json();
}

function render(st){
  lastState = st;

  const open = !!st.isOpen;

  // жёстко выставляем только одно состояние
  statusEl.classList.toggle('open', open);
  statusEl.classList.toggle('closed', !open);
  statusEl.textContent = open ? 'OPEN' : 'CLOSED';
  statusEl.setAttribute('aria-disabled', open ? 'false' : 'true');

  document.body.classList.toggle('is-closed', !open);

  if (open) {
    timerEl.textContent = '';
    metaEl.textContent = `lobby: OPEN`;
  } else {
    // таймер до закрытия/открытия: берём openUntil если он в будущем
    const until = Number(st.openUntil || 0);
    if (until > Date.now()) timerEl.textContent = fmt(until - Date.now());
    else timerEl.textContent = '';
    metaEl.textContent = `lobby: CLOSED`;
  }
}

async function tick(){
  try{
    const st = await fetchState();
    render(st);
  } catch(e){
    metaEl.textContent = `offline: ${String(e.message || e)}`;
  }
}

/* ======================
   ЭФФЕКТЫ НА МАКС (разумно)
====================== */
const isTouchDevice = matchMedia('(pointer: coarse)').matches;
let targetEngage = 0;
let engage = 0;
let hold = 0;
let warp = 0;
let tiltX = 0, tiltY = 0;
let lastTs = performance.now();
let jumping = false;

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function smoothstep(t){ return t * t * (3 - 2 * t); }

function setVars(){
  document.body.style.setProperty('--warp', warp.toFixed(3));

  const open = !!lastState?.isOpen;
  const baseSpeed = open ? 18 : 34;
  const minSpeed  = open ? 10 : 30;
  const s = baseSpeed - (baseSpeed - minSpeed) * clamp(warp, 0, 1);
  document.body.style.setProperty('--bgSpeed', `${s.toFixed(2)}s`);

  const hue = open ? (warp * 120) : 0;
  document.body.style.setProperty('--bgHue', `${hue.toFixed(1)}deg`);

  document.body.style.setProperty('--tiltX', `${tiltX.toFixed(2)}deg`);
  document.body.style.setProperty('--tiltY', `${tiltY.toFixed(2)}deg`);

  const glow = 0.12 + 0.10 * warp;
  document.body.style.setProperty('--textGlow', glow.toFixed(3));
}

function enterFromOpen(){
  if (lastState?.isOpen) targetEngage = 1;
}
function leaveFromOpen(){
  targetEngage = 0;
}

statusEl.addEventListener('mouseenter', () => { if (!isTouchDevice) enterFromOpen(); });
statusEl.addEventListener('mouseleave', () => { if (!isTouchDevice) leaveFromOpen(); });

statusEl.addEventListener('touchstart', enterFromOpen, { passive:true });
statusEl.addEventListener('touchend', leaveFromOpen, { passive:true });
statusEl.addEventListener('touchcancel', leaveFromOpen, { passive:true });

function applyPointerTilt(x, y){
  const r = wrapEl.getBoundingClientRect();
  const nx = (x - (r.left + r.width/2)) / (r.width/2);
  const ny = (y - (r.top + r.height/2)) / (r.height/2);
  tiltY = clamp(nx, -1, 1) * 7;
  tiltX = clamp(-ny, -1, 1) * 5;
}

window.addEventListener('mousemove', (e) => {
  if (isTouchDevice) return;
  if (targetEngage < 0.5) return;
  applyPointerTilt(e.clientX, e.clientY);
}, { passive:true });

window.addEventListener('touchmove', (e) => {
  const t = e.touches?.[0];
  if (!t) return;
  if (lastState?.isOpen) targetEngage = 1;
  applyPointerTilt(t.clientX, t.clientY);
}, { passive:true });

document.body.addEventListener('touchend', () => { targetEngage = 0; }, { passive:true });
document.body.addEventListener('touchcancel', () => { targetEngage = 0; }, { passive:true });

/* ======================
   Stars (MAX)
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

  // больше звёзд, но не убиваем мобилки
  const density = isTouchDevice ? 15000 : 9000;
  const count = Math.floor((W * H) / density);

  stars = new Array(count).fill(0).map(() => ({
    x: Math.random()*W,
    y: Math.random()*H,
    r: 0.6 + Math.random()*1.8,
    a: 0.12 + Math.random()*0.55,
    vx: 0.18 + Math.random()*0.16,
    vy: -0.08 + Math.random()*0.16,
    tw: 0.50 + Math.random()*1.4,
    ph: Math.random()*Math.PI*2
  }));
}
window.addEventListener('resize', resize);
resize();

function drawStars(ts){
  ctx.clearRect(0, 0, W, H);
  const open = !!lastState?.isOpen;

  const baseSpeed = open ? 0.40 : 0.16;
  const speed = baseSpeed + (open ? (engage * (0.70 + warp*0.90)) : 0);
  const twMul = open ? 1.15 : 0.60;

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
      ? `rgba(88,242,255,${alpha*0.10})`
      : `rgba(255,110,120,${alpha*0.06})`;

    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
    ctx.fill();

    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r*3.1, 0, Math.PI*2);
    ctx.fill();
  }
}

/* ======================
   Jump to room
====================== */
statusEl.addEventListener('click', () => {
  if (!lastState?.isOpen || jumping) return;
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

  const open = !!lastState?.isOpen;

  engage += (targetEngage - engage) * 0.09;
  const engaged = open && engage > 0.02;

  if (engaged) hold = clamp(hold + dt*1.05, 0, 1.6);
  else hold = clamp(hold - dt*1.45, 0, 1.6);

  const t = smoothstep(hold/1.6);
  const targetWarp = open ? clamp(0.08 + 0.82*t, 0, 1) * engage : 0;
  warp += (targetWarp - warp) * 0.08;

  if (!engaged){
    tiltX *= 0.85;
    tiltY *= 0.85;
  }

  setVars();
  drawStars(ts);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
setInterval(tick, 1000);
tick();