const statusEl = document.getElementById('status');
const timerEl = document.getElementById('timer');
const metaEl = document.getElementById('meta');
const wrapEl = document.getElementById('wrap');

const jumpFx = document.getElementById('jumpFx');

const canvas = document.getElementById('stars');
const ctx = canvas.getContext('2d', { alpha: true });

function fmt(ms){
  const s = Math.max(0, Math.floor(ms/1000));
  const hh = String(Math.floor(s/3600)).padStart(2,'0');
  const mm = String(Math.floor((s%3600)/60)).padStart(2,'0');
  const ss = String(s%60).padStart(2,'0');
  return `${hh}:${mm}:${ss}`;
}

let lastState = null;

function apiBase(){
  return (window.API_BASE || '').trim().replace(/\/+$/, '');
}

async function fetchState(){
  const base = apiBase();
  const r = await fetch(`${base}/state`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status} /state`);
  return r.json();
}

function render(st){
  lastState = st;
  document.body.classList.toggle('is-closed', !st.isOpen);

  if (st.isOpen){
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
  }

  metaEl.textContent = `window: ${st.windowId}`;
}

async function tick(){
  try{
    const st = await fetchState();
    render(st);

    if (!st.isOpen && st.reopenAt){
      const target = new Date(st.reopenAt).getTime();
      timerEl.textContent = fmt(target - Date.now());
    }
  }catch(e){
    metaEl.textContent = `offline: ${String(e.message || e)}`;
  }
}

/* ===== hover только на OPEN ===== */
let hoveringOpen = false;

function onEnter(){
  if (lastState?.isOpen) hoveringOpen = true;
}
function onLeave(){
  hoveringOpen = false;
}

statusEl.addEventListener('mouseenter', onEnter);
statusEl.addEventListener('mouseleave', onLeave);
statusEl.addEventListener('touchstart', onEnter, { passive:true });
statusEl.addEventListener('touchend', onLeave, { passive:true });
statusEl.addEventListener('touchcancel', onLeave, { passive:true });

/* ===== управление параметрами эффекта ===== */
let hold = 0;          // 0..1.6
let warp = 0;          // 0..1
let tiltX = 0, tiltY = 0;
let lastTs = performance.now();

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function smoothstep(t){ return t*t*(3-2*t); }

function setVars(){
  document.body.style.setProperty('--warp', warp.toFixed(3));

  // Фон: медленный и плавный, ускорение НЕ резкое
  const baseSpeed = (lastState?.isOpen ? 28 : 34);
  const minSpeed  = (lastState?.isOpen ? 18 : 30); // медленнее чем было
  const s = baseSpeed - (baseSpeed - minSpeed) * clamp(warp,0,1);
  document.body.style.setProperty('--bgSpeed', `${s.toFixed(2)}s`);

  // Hue: тоже медленнее
  const hue = (lastState?.isOpen ? (warp * 80) : 0);
  document.body.style.setProperty('--bgHue', `${hue.toFixed(1)}deg`);

  // наклон — только при удержании OPEN (очень слегка)
  document.body.style.setProperty('--tiltX', `${tiltX.toFixed(2)}deg`);
  document.body.style.setProperty('--tiltY', `${tiltY.toFixed(2)}deg`);

  // немного усилим свечение текста в удержании (мягко)
  const glow = 0.10 + 0.08 * warp;
  document.body.style.setProperty('--textGlow', glow.toFixed(3));
}

/* наклон только при удержании OPEN */
function applyPointerTilt(x, y){
  if (!hoveringOpen) return;
  const r = wrapEl.getBoundingClientRect();
  const nx = (x - (r.left + r.width/2)) / (r.width/2);
  const ny = (y - (r.top + r.height/2)) / (r.height/2);
  tiltY = clamp(nx, -1, 1) * 6;
  tiltX = clamp(-ny, -1, 1) * 4;
}

window.addEventListener('mousemove', (e) => applyPointerTilt(e.clientX, e.clientY), { passive:true });
window.addEventListener('touchmove', (e) => {
  const t = e.touches?.[0];
  if (t) applyPointerTilt(t.clientX, t.clientY);
}, { passive:true });

/* ===== Stars: равномерно по всему экрану + мягкий дрейф ===== */
let W=0,H=0,DPR=1;
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

  // меньше “шум”: чуть меньше плотность, но равномерно
  const count = Math.floor((W * H) / 12000);
  stars = new Array(count).fill(0).map(() => ({
    x: Math.random()*W,
    y: Math.random()*H,
    r: 0.6 + Math.random()*1.5,
    a: 0.10 + Math.random()*0.45,
    // единое направление + небольшой разброс
    vx: 0.18 + Math.random()*0.10,
    vy: -0.06 + Math.random()*0.12,
    tw: 0.5 + Math.random()*1.2,
    ph: Math.random()*Math.PI*2
  }));
}
window.addEventListener('resize', resize);
resize();

function drawStars(ts, dt){
  ctx.clearRect(0,0,W,H);

  const open = !!lastState?.isOpen;

  // скорость: всегда чуть движется; при удержании OPEN — чуть быстрее
  const baseSpeed = open ? 0.40 : 0.18;
  const boost = (open && hoveringOpen) ? (0.90 + warp*0.70) : 0.0;
  const speed = baseSpeed + boost;

  // CLOSED: twinkle намного мягче и реже
  const twMul = open ? 1.0 : 0.55;

  for (const s of stars){
    // движение (без “воды”: без колебаний, просто дрейф)
    s.x += s.vx * speed;
    s.y += s.vy * speed;

    // wrap
    if (s.x > W + 10) s.x = -10;
    if (s.x < -10) s.x = W + 10;
    if (s.y > H + 10) s.y = -10;
    if (s.y < -10) s.y = H + 10;

    // плавное мерцание (очень мягкое)
    const tw = (Math.sin(ts*0.001*s.tw*twMul + s.ph) + 1) * 0.5; // 0..1
    const alpha = s.a * (0.55 + tw*0.45);

    // цвет glow: OPEN холоднее, CLOSED теплее и слабее
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

/* ===== Альтернативный переход (без гиперстримов) =====
   Идея: “белая вспышка + лёгкий зум + fade”, а звёзды чуть ускоряются
*/
let jumping = false;
statusEl.addEventListener('click', () => {
  if (!lastState?.isOpen || jumping) return;

  jumping = true;
  document.body.classList.add('jumping');

  // форсируем короткое ускорение звёзд (но без туннеля)
  hoveringOpen = true;
  hold = 1.6;
  warp = 1;
  setVars();

  setTimeout(() => {
    location.href = '/room.html';
  }, 520);
});

function frame(ts){
  const dt = Math.min(0.05, (ts - lastTs)/1000);
  lastTs = ts;

  const open = !!lastState?.isOpen;
  const engaged = open && hoveringOpen;

  if (engaged) hold = clamp(hold + dt*0.95, 0, 1.6);
  else hold = clamp(hold - dt*1.35, 0, 1.6);

  const t = smoothstep(hold/1.6);
  const targetWarp = open ? (engaged ? clamp(0.08 + 0.75*t, 0, 1) : 0) : 0;
  warp += (targetWarp - warp) * 0.07;

  if (!engaged){
    tiltX *= 0.85;
    tiltY *= 0.85;
  }

  setVars();
  drawStars(ts, dt);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
setInterval(tick, 1000);
tick();
