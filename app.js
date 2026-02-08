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

statusEl.addEventListener('mouseenter', () => {
  if (lastState?.isOpen) body.classList.add('hover-open');
});

statusEl.addEventListener('mouseleave', () => {
  body.classList.remove('hover-open');
});

// для мобильных (tap)
statusEl.addEventListener('touchstart', () => {
  if (lastState?.isOpen) body.classList.add('hover-open');
}, { passive:true });

statusEl.addEventListener('touchend', () => {
  body.classList.remove('hover-open');
});

setInterval(tick, 1000);
tick();
