const statusEl = document.getElementById('status');
const timerEl = document.getElementById('timer');
const metaEl = document.getElementById('meta');
const wrapEl = document.getElementById('wrap');

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

  // CLOSED/OPEN класс на body для палитры и поведения звёзд
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

/* ===== WARP + STARS: плавный разгон + “чем дольше — тем сильнее” ===== */
let hoveringOpen = false;
let warp = 0;
let starsBoost = 0;

let hold = 0;
let lastTs = performance.now();

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

function setVars(){
  document.body.style.setProperty('--warp', warp.toFixed(3));
  document.body.style.setProperty('--starsBoost', starsBoost.toFixed(3));

  // скорость неона: базово быстрее, а при ускорении — ещё быстрее
  // (меньше секунд => быстрее анимация)
  const base = lastState?.isOpen ? 12 : 10; // по умолчанию быстрее в целом
  const min = lastState?.isOpen ? 4.8 : 6.0; // на пике
  const k = clamp(warp, 0, 1);
  const dur = base - (base - min) * k; // от base к min
  document.body.style.setProperty('--neonDur', `${dur.toFixed(2)}s`);
}

let tiltForce = 0;   // 0..1 (сила наклона)
let tiltX = 0;       // deg
let tiltY = 0;       // deg

function loop(ts){
  const dt = Math.min(0.05, (ts - lastTs) / 1000);
  lastTs = ts;

  // эффект включается если: hover OPEN ИЛИ tilt (на телефоне)
  const engaged = (hoveringOpen && lastState?.isOpen) || (tiltForce > 0.02 && lastState?.isOpen);

  if (engaged) hold = clamp(hold + dt * 0.95, 0, 1.6);
  else hold = clamp(hold - dt * 1.35, 0, 1.6);

  const t = hold / 1.6;                 // 0..1
  const easeUp = t * t * (3 - 2 * t);   // smoothstep

  // добавляем вклад от наклона (чем сильнее наклон — тем сильнее разгон)
  const tiltBoost = tiltForce * 0.55;   // 0..0.55

  const targetWarp  = (lastState?.isOpen ? (0.18 + 1.05 * easeUp + tiltBoost) : 0);
  const targetStars = (lastState?.isOpen ? (0.10 + 1.15 * easeUp + tiltBoost) : 0);

  warp += (targetWarp - warp) * 0.06;
  starsBoost += (targetStars - starsBoost) * 0.045;

  // наклон текста (плавно)
  document.body.style.setProperty('--tiltX', `${tiltX.toFixed(2)}deg`);
  document.body.style.setProperty('--tiltY', `${tiltY.toFixed(2)}deg`);

  setVars();
  requestAnimationFrame(loop);
}

function onEnter(){
  if (lastState?.isOpen) hoveringOpen = true;
}
function onLeave(){
  hoveringOpen = false;
}

statusEl.addEventListener('mouseenter', onEnter);
statusEl.addEventListener('mouseleave', onLeave);

// mobile (tap hold)
statusEl.addEventListener('touchstart', onEnter, { passive:true });
statusEl.addEventListener('touchend', onLeave, { passive:true });
statusEl.addEventListener('touchcancel', onLeave, { passive:true });

/* ===== GYRO (iOS needs permission) ===== */
async function requestMotionPermission(){
  try{
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      const res = await DeviceOrientationEvent.requestPermission();
      // 'granted' or 'denied'
      return res === 'granted';
    }
    return true; // Android/others often don't need it
  }catch{
    return false;
  }
}

// просим разрешение при первом “осознанном” касании (без спама)
let motionEnabled = false;
async function enableMotionOnce(){
  if (motionEnabled) return;
  const ok = await requestMotionPermission();
  motionEnabled = ok;

  if (ok){
    window.addEventListener('deviceorientation', (e) => {
      // gamma: left/right, beta: front/back
      const g = typeof e.gamma === 'number' ? e.gamma : 0;
      const b = typeof e.beta === 'number' ? e.beta : 0;

      // ограничим, чтобы не шатало
      const gx = clamp(g, -18, 18);
      const bx = clamp(b, -18, 18);

      // наклон текста (в градусах)
      tiltY = gx * 0.35;      // rotateY
      tiltX = -bx * 0.22;     // rotateX

      // сила эффекта = насколько сильно наклонён телефон
      const mag = Math.sqrt(gx*gx + bx*bx) / 25; // ~0..1
      tiltForce = clamp(mag, 0, 1);
    }, { passive:true });
  }
}

// триггер на мобиле: тап по экрану или по OPEN
document.body.addEventListener('touchstart', enableMotionOnce, { passive:true });
statusEl.addEventListener('touchstart', enableMotionOnce, { passive:true });

requestAnimationFrame(loop);

setInterval(tick, 1000);
tick();
