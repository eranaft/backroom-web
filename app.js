const statusEl = document.getElementById('status');
const timerEl = document.getElementById('timer');
const metaEl = document.getElementById('meta');

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

/* ===== Космос: плавный разгон с “прогревом” ===== */
let hoveringOpen = false;

// текущие значения, которые уходят к целевым
let warp = 0;        // 0..~1.2
let starsBoost = 0;  // 0..~1.2

// “как долго держим” (секунды), чтобы эффект нарастал
let hold = 0;        // 0..1.5 (примерно)
let lastTs = performance.now();

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

function setVars(){
  // можно оставить как есть, CSS это скушает
  document.body.style.setProperty('--warp', warp.toFixed(3));
  document.body.style.setProperty('--starsBoost', starsBoost.toFixed(3));
}

function loop(ts){
  const dt = Math.min(0.05, (ts - lastTs) / 1000); // защита от скачков
  lastTs = ts;

  // “прогрев”: пока держим hover — растёт, отпустили — плавно падает
  if (hoveringOpen) hold = clamp(hold + dt * 0.9, 0, 1.6);
  else hold = clamp(hold - dt * 1.3, 0, 1.6);

  // Нелинейная кривая: сначала мягко, потом заметнее
  // (чем выше hold, тем сильнее target)
  const t = hold / 1.6;                 // 0..1
  const easeUp = t * t * (3 - 2 * t);   // smoothstep 0..1

  const targetWarp = hoveringOpen ? (0.25 + 1.05 * easeUp) : 0;
  const targetStars = hoveringOpen ? (0.15 + 1.15 * easeUp) : 0;

  // Плавное приближение
  warp += (targetWarp - warp) * 0.06;
  starsBoost += (targetStars - starsBoost) * 0.045;

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

requestAnimationFrame(loop);

setInterval(tick, 1000);
tick();
