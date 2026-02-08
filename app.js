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
const body = document.body;
let hoveringOpen = false;
let warp = 0;        // 0..1
let starsBoost = 0;  // 0..1
let rafId = null;

function setVars(){
  document.body.style.setProperty('--warp', warp.toFixed(3));
  document.body.style.setProperty('--starsBoost', starsBoost.toFixed(3));
}

function loop(){
  // target растёт, пока держишь hover, и плавно падает когда отпустил
  const target = hoveringOpen ? 1 : 0;

  // плавное приближение (без рывков)
  warp += (target - warp) * 0.04;

  // звёзды нарастают “дольше”, чтобы было ощущение прогрева
  const starsTarget = hoveringOpen ? 1 : 0;
  starsBoost += (starsTarget - starsBoost) * 0.02;

  setVars();
  rafId = requestAnimationFrame(loop);
}

function startAnim(){
  if (!rafId) rafId = requestAnimationFrame(loop);
}

startAnim();

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



setInterval(tick, 1000);
tick();
