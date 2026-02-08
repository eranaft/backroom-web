const statusEl = document.getElementById('status');
const timerEl = document.getElementById('timer');
const metaEl = document.getElementById('meta');
const wrapEl = document.getElementById('wrap');
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

async function fetchState(){
  const r = await fetch(`${window.API_BASE}/state`, { cache: 'no-store' });
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

statusEl.addEventListener('click', () => {
  if (lastState?.isOpen) location.href = '/room.html';
});

async function tick(){
  try{
    const st = await fetchState();
    render(st);

    if (!st.isOpen && st.reopenAt){
      const target = new Date(st.reopenAt).getTime();
      timerEl.textContent = fmt(target - Date.now());
    }
  }catch(e){
    metaEl.textContent = 'offline';
  }
}

/* ====== warp + tilt (fallback работает в Telegram) ====== */
let hoveringOpen = false;
let warp = 0;            // 0..1
let hold = 0;            // 0..1.6
let tiltForce = 0;       // 0..1
let tiltX = 0;           // deg
let tiltY = 0;           // deg
let lastTs = performance.now();

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function smoothstep(t){ return t*t*(3-2*t); }

function setVars(){
  document.body.style.setProperty('--warp', warp.toFixed(3));
  document.body.style.setProperty('--tiltX', `${tiltX.toFixed(2)}deg`);
  document.body.style.setProperty('--tiltY', `${tiltY.toFixed(2)}deg`);

  // Скорость “перелива” градиента: быстрее всегда, ещё быстрее при warp/tilt
  const engaged = clamp(warp, 0, 1);
  const base = (lastState?.isOpen ? 10.5 : 9.5);  // быстрее в целом
  const min  = (lastState?.isOpen ? 3.8  : 5.5);  // на пике
  const dur = base - (base - min) * engaged;
  document.body.style.setProperty('--neonSpeed', `${dur.toFixed(2)}s`);

  // Hue тоже ускоряем (ощутимый перелив цвета)
  const hue = (lastState?.isOpen ? (engaged * 140) : 0);
  document.body.style.setProperty('--hue', `${hue.toFixed(1)}deg`);
}

function onEnter(){ if (lastState?.isOpen) hoveringOpen = true; }
function onLeave(){ hoveringOpen = false; tiltForce *= 0.85; }

statusEl.addEventListener('mouseenter', onEnter);
statusEl.addEventListener('mouseleave', onLeave);
statusEl.addEventListener('touchstart', onEnter, { passive:true });
statusEl.addEventListener('touchend', onLeave, { passive:true });
statusEl.addEventListener('touchcancel', onLeave, { passive:true });

/* Touch/mouse tilt fallback */
function applyPointerTilt(x, y){
  const r = wrapEl.getBoundingClientRect();
  const nx = (x - (r.left + r.width/2)) / (r.width/2);
  const ny = (y - (r.top + r.height/2)) / (r.height/2);

  tiltY = clamp(nx, -1, 1) * 8;   // deg
  tiltX = clamp(-ny, -1, 1) * 6;  // deg
  tiltForce = clamp(Math.sqrt(nx*nx + ny*ny), 0, 1);
}

window.addEventListener('mousemove', (e) => applyPointerTilt(e.clientX, e.clientY), { passive:true });
window.addEventListener('touchmove', (e) => {
  const t = e.touches?.[0];
  if (t) applyPointerTilt(t.clientX, t.clientY);
}, { passive:true });

/* ====== Canvas stars (random, smooth) ====== */
let W = 0, H = 0, DPR = 1;
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

  // количество звёзд зависит от размера
  const count = Math.floor((W * H) / 9000); // плотнее/реже можно крутить
  stars = new Array(count).fill(0).map(() => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: 0.6 + Math.random() * 1.6,
    baseA: 0.15 + Math.random() * 0.45,
    tw: 0.6 + Math.random() * 2.2,     // скорость мерцания
    ph: Math.random() * Math.PI * 2,   // фаза
    vx: (Math.random() - 0.5) * 0.08,  // лёгкий дрейф
    vy: (Math.random() - 0.5) * 0.08
  }));
}
window.addEventListener('resize', resize);
resize();

function drawStars(time){
  ctx.clearRect(0, 0, W, H);

  const open = !!lastState?.isOpen;

  // в OPEN звёзды “летят” (скорость от warp), в CLOSED — стоят, только twinkle
  const speed = open ? (0.15 + warp * 2.3) : 0;
  const twMul = open ? (1.0 + warp * 1.2) : 0.9;

  for (let i=0;i<stars.length;i++){
    const s = stars[i];

    // движение только в OPEN
    if (open){
      s.x += (s.vx * speed);
      s.y += (s.vy * speed);

      // wrap
      if (s.x < -20) s.x = W + 20;
      if (s.x > W + 20) s.x = -20;
      if (s.y < -20) s.y = H + 20;
      if (s.y > H + 20) s.y = -20;
    }

    // ПЛАВНОЕ мерцание (без прыжков)
    const tw = (Math.sin(time * 0.001 * s.tw * twMul + s.ph) + 1) * 0.5; // 0..1
    const a = s.baseA * (0.55 + tw * 0.75);

    // в CLOSED делаем более “бордовое” сияние слегка
    const isClosed = !open;
    const glow = isClosed ? 0.9 : 1.0;

    ctx.beginPath();
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
    ctx.fill();

    // мягкий glow
    ctx.beginPath();
    ctx.fillStyle = isClosed
      ? `rgba(255,90,110,${a * 0.18 * glow})`
      : `rgba(88,242,255,${a * 0.14 * glow})`;
    ctx.arc(s.x, s.y, s.r * 2.8, 0, Math.PI*2);
    ctx.fill();
  }
}

/* ====== main loop ====== */
function loop(ts){
  const dt = Math.min(0.05, (ts - lastTs) / 1000);
  lastTs = ts;

  const engaged = (hoveringOpen && lastState?.isOpen) || (tiltForce > 0.02 && lastState?.isOpen);

  // hold “нарастает” пока engaged
  if (engaged) hold = clamp(hold + dt * 0.95, 0, 1.6);
  else hold = clamp(hold - dt * 1.35, 0, 1.6);

  const t = smoothstep(hold / 1.6); // 0..1

  const tiltBoost = tiltForce * 0.55;
  const targetWarp = (lastState?.isOpen ? clamp(0.10 + 1.10 * t + tiltBoost, 0, 1) : 0);

  warp += (targetWarp - warp) * 0.06;

  // tilt затухает сам
  tiltForce *= 0.985;

  setVars();
  drawStars(ts);

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
setInterval(tick, 1000);
tick();
