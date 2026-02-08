const audio = document.getElementById('audio');
const tracksEl = document.getElementById('tracks');
const windowBadge = document.getElementById('windowBadge');
const statusLine = document.getElementById('statusLine');
const coverLabel = document.getElementById('coverLabel');
const tTitle = document.getElementById('tTitle');

const q = document.getElementById('q');
const exitBtn = document.getElementById('exitBtn');

const prevBtn = document.getElementById('prevBtn');
const playBtn = document.getElementById('playBtn');
const nextBtn = document.getElementById('nextBtn');

const yandexLink = document.getElementById('yandexLink');
const spotifyLink = document.getElementById('spotifyLink');

function apiBase(){
  return (window.API_BASE || '').trim().replace(/\/+$/, '');
}

async function fetchState(){
  const r = await fetch(`${apiBase()}/state`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/* ====== DATA (потом заменим на твои треки) ====== */
const TRACKS = [
  {
    id: 't1',
    title: 'Track 01 (demo)',
    hint: 'BACKROOM • window drop',
    url: '/tracks/demo.mp3',        // <- если у тебя другой путь, поменяем
    yandex: 'https://music.yandex.ru/',
    spotify: 'https://open.spotify.com/'
  },
  {
    id: 't2',
    title: 'Track 02 (demo)',
    hint: 'neon room',
    url: '/tracks/demo.mp3',
    yandex: 'https://music.yandex.ru/',
    spotify: 'https://open.spotify.com/'
  }
];

let filtered = [...TRACKS];
let currentIndex = 0;

function renderList(){
  tracksEl.innerHTML = '';
  filtered.forEach((t, idx) => {
    const row = document.createElement('div');
    row.className = 'track';
    row.innerHTML = `
      <div class="trackLeft">
        <div class="pill"><div class="playIcon"></div></div>
        <div style="min-width:0">
          <div class="tName">${escapeHtml(t.title)}</div>
          <div class="tHint">${escapeHtml(t.hint || '')}</div>
        </div>
      </div>
      <div class="trackRight">
        <button class="btn" data-act="yandex">Yandex</button>
        <button class="btn" data-act="spotify">Spotify</button>
        <button class="btn primary" data-act="play">Play</button>
      </div>
    `;

    row.querySelector('[data-act="play"]').onclick = () => playIndex(idx);
    row.querySelector('[data-act="yandex"]').onclick = () => openLink(t.yandex);
    row.querySelector('[data-act="spotify"]').onclick = () => openLink(t.spotify);

    tracksEl.appendChild(row);
  });

  if (filtered.length === 0){
    const empty = document.createElement('div');
    empty.className = 'track';
    empty.textContent = 'Ничего не найдено.';
    tracksEl.appendChild(empty);
  }
}

function openLink(url){
  if (!url) return;
  window.open(url, '_blank', 'noreferrer');
}

function playIndex(idx){
  currentIndex = Math.max(0, Math.min(idx, filtered.length - 1));
  const t = filtered[currentIndex];
  tTitle.textContent = t.title;
  coverLabel.textContent = t.title;
  audio.src = t.url;

  yandexLink.href = t.yandex || '#';
  spotifyLink.href = t.spotify || '#';

  audio.play().catch(()=>{});
  playBtn.textContent = 'Pause';
}

function prev(){
  if (filtered.length === 0) return;
  playIndex((currentIndex - 1 + filtered.length) % filtered.length);
}
function next(){
  if (filtered.length === 0) return;
  playIndex((currentIndex + 1) % filtered.length);
}

prevBtn.onclick = prev;
nextBtn.onclick = next;

playBtn.onclick = () => {
  if (!audio.src) playIndex(0);
  else if (audio.paused){ audio.play(); playBtn.textContent = 'Pause'; }
  else { audio.pause(); playBtn.textContent = 'Play'; }
};

audio.addEventListener('pause', () => playBtn.textContent = 'Play');
audio.addEventListener('play', () => playBtn.textContent = 'Pause');

q.addEventListener('input', () => {
  const s = q.value.trim().toLowerCase();
  filtered = TRACKS.filter(t => t.title.toLowerCase().includes(s) || (t.hint||'').toLowerCase().includes(s));
  renderList();
});

exitBtn.onclick = () => location.href = '/index.html';

/* ====== Subtle parallax (менее заметно) ====== */
let targetX = 0, targetY = 0;
let curX = 0, curY = 0;

function setPar(x, y){
  // амплитуда очень маленькая (как ты хотел)
  targetX = x * 10; // px
  targetY = y * 8;  // px
}

function onMove(clientX, clientY){
  const nx = (clientX / window.innerWidth) * 2 - 1;
  const ny = (clientY / window.innerHeight) * 2 - 1;
  setPar(nx, ny);
}

window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY), { passive:true });
window.addEventListener('touchmove', (e) => {
  const t = e.touches?.[0];
  if (t) onMove(t.clientX, t.clientY);
}, { passive:true });

function raf(){
  // сглаживание
  curX += (targetX - curX) * 0.08;
  curY += (targetY - curY) * 0.08;

  document.documentElement.style.setProperty('--parX', `${curX.toFixed(2)}px`);
  document.documentElement.style.setProperty('--parY', `${curY.toFixed(2)}px`);

  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

/* ====== State ====== */
async function poll(){
  try{
    const st = await fetchState();
    windowBadge.textContent = `window: ${st.windowId}`;
    statusLine.textContent = st.isOpen ? 'OPEN' : 'CLOSED';
  }catch(e){
    statusLine.textContent = 'offline';
  }
}
setInterval(poll, 2000);
poll();

renderList();

/* utils */
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[m]));
}
