// ===== ROUTER (virtual pages) =====
const tabs = [...document.querySelectorAll('.tab')];
const pages = [...document.querySelectorAll('.page')];

function setActiveTab(route){
  tabs.forEach(t => t.classList.toggle('active', t.dataset.route === route));
}

function showPage(route){
  const next = pages.find(p => p.dataset.page === route);
  const cur = pages.find(p => p.classList.contains('active'));
  if (!next || next === cur) return;

  // richer transition
  if (cur){
    cur.classList.add('exiting');
    cur.classList.remove('active');
    setTimeout(() => cur.classList.remove('exiting'), 520);
  }

  next.classList.add('entering');
  next.classList.add('active');
  setTimeout(() => next.classList.remove('entering'), 20);

  setActiveTab(route);
  history.replaceState(null, '', `#${route}`);
}

tabs.forEach(t => t.addEventListener('click', () => showPage(t.dataset.route)));
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => showPage(b.dataset.go)));

window.addEventListener('load', () => {
  const route = (location.hash || '#home').slice(1);
  showPage(route);
});

// ===== SUBTLE PARALLAX (react to everything) =====
let tx = 0, ty = 0, cx = 0, cy = 0;
function setTargetFromXY(x, y){
  const nx = (x / window.innerWidth) * 2 - 1;
  const ny = (y / window.innerHeight) * 2 - 1;
  tx = nx * 14;
  ty = ny * 10;
}
window.addEventListener('mousemove', (e) => setTargetFromXY(e.clientX, e.clientY), { passive:true });
window.addEventListener('touchmove', (e) => {
  const t = e.touches?.[0];
  if (t) setTargetFromXY(t.clientX, t.clientY);
}, { passive:true });

function rafPar(){
  cx += (tx - cx) * 0.06;
  cy += (ty - cy) * 0.06;
  document.documentElement.style.setProperty('--parX', `${cx.toFixed(2)}px`);
  document.documentElement.style.setProperty('--parY', `${cy.toFixed(2)}px`);
  requestAnimationFrame(rafPar);
}
requestAnimationFrame(rafPar);

// ===== STARS (calm space) =====
const canvas = document.getElementById('stars');
const ctx = canvas.getContext('2d', { alpha:true });

let W=0,H=0,DPR=1, stars=[];
function resize(){
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = Math.floor(window.innerWidth);
  H = Math.floor(window.innerHeight);
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  const count = Math.floor((W*H)/14000);
  stars = new Array(count).fill(0).map(() => ({
    x: Math.random()*W,
    y: Math.random()*H,
    r: 0.6 + Math.random()*1.6,
    a: 0.10 + Math.random()*0.40,
    vx: 0.12 + Math.random()*0.10,
    vy: -0.04 + Math.random()*0.08,
    tw: 0.4 + Math.random()*1.1,
    ph: Math.random()*Math.PI*2
  }));
}
window.addEventListener('resize', resize);
resize();

function drawStars(ts){
  ctx.clearRect(0,0,W,H);
  for (const s of stars){
    s.x += s.vx;
    s.y += s.vy;
    if (s.x > W+10) s.x = -10;
    if (s.x < -10) s.x = W+10;
    if (s.y > H+10) s.y = -10;
    if (s.y < -10) s.y = H+10;

    const tw = (Math.sin(ts*0.001*s.tw + s.ph)+1)*0.5;
    const a = s.a * (0.65 + tw*0.35);

    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
    ctx.fill();

    ctx.fillStyle = `rgba(88,242,255,${a*0.06})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r*2.8, 0, Math.PI*2);
    ctx.fill();
  }
  requestAnimationFrame(drawStars);
}
requestAnimationFrame(drawStars);

// ===== DATA + GLOBAL PLAYER (plays everywhere) =====
const audio = document.getElementById('audio');
const mName = document.getElementById('mName');
const mHint = document.getElementById('mHint');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const toggleBtn = document.getElementById('toggle');

const listEl = document.getElementById('list');
const searchEl = document.getElementById('search');

const pTitle = document.getElementById('pTitle');
const pDesc = document.getElementById('pDesc');
const chaptersEl = document.getElementById('chapters');
const yandexBtn = document.getElementById('yandexBtn');
const spotifyBtn = document.getElementById('spotifyBtn');
const windowBadge = document.getElementById('windowBadge');

function apiBase(){ return (window.API_BASE || '').trim().replace(/\/+$/, ''); }
async function fetchState(){
  const r = await fetch(`${apiBase()}/state`, { cache:'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
async function poll(){
  try{
    const st = await fetchState();
    windowBadge.textContent = `window: ${st.windowId}`;
  }catch{}
}
setInterval(poll, 2000);
poll();

// Демо. Потом подставим твои треки/кассеты.
const TRACKS = [
  {
    id:'t1',
    title:'Track 01 (demo)',
    hint:'BACKROOM • window drop',
    url:'/tracks/demo.mp3',
    yandex:'https://music.yandex.ru/',
    spotify:'https://open.spotify.com/',
    desc:`Мини-описание трека.\nЗдесь будут твои заметки и смысл.`,
    chapters:[
      { t:'00:00', s:0, note:'Intro' },
      { t:'00:18', s:18, note:'Verse' },
      { t:'00:52', s:52, note:'Hook' },
    ]
  },
  {
    id:'t2',
    title:'Track 02 (demo)',
    hint:'neon room',
    url:'/tracks/demo.mp3',
    yandex:'https://music.yandex.ru/',
    spotify:'https://open.spotify.com/',
    desc:`Описание второго трека.\nТемнее, глубже.`,
    chapters:[
      { t:'00:00', s:0, note:'Start' },
      { t:'00:40', s:40, note:'Drop' },
    ]
  },
];

let filtered = [...TRACKS];
let idx = -1;

function renderList(){
  listEl.innerHTML = '';
  filtered.forEach((t, i) => {
    const row = document.createElement('div');
    row.className = 'item';
    row.innerHTML = `
      <div class="itemL">
        <div class="name">${escapeHtml(t.title)}</div>
        <div class="hint">${escapeHtml(t.hint || '')}</div>
      </div>
      <div class="itemR">
        <button class="smallBtn" data-act="y">Yandex</button>
        <button class="smallBtn" data-act="s">Spotify</button>
        <button class="smallBtn primary" data-act="p">Play</button>
      </div>
    `;
    row.querySelector('[data-act="p"]').onclick = () => playTrackById(t.id);
    row.querySelector('[data-act="y"]').onclick = () => openLink(t.yandex);
    row.querySelector('[data-act="s"]').onclick = () => openLink(t.spotify);
    listEl.appendChild(row);
  });

  if (filtered.length === 0){
    const empty = document.createElement('div');
    empty.className = 'item';
    empty.textContent = 'Ничего не найдено.';
    listEl.appendChild(empty);
  }
}

function openLink(url){
  if (!url) return;
  window.open(url, '_blank', 'noreferrer');
}

function playTrackById(id){
  const i = TRACKS.findIndex(t => t.id === id);
  if (i === -1) return;
  idx = i;
  const t = TRACKS[idx];

  audio.src = t.url;
  audio.play().catch(()=>{});
  toggleBtn.textContent = 'Pause';

  mName.textContent = t.title;
  mHint.textContent = t.hint || '—';

  // player page content
  pTitle.textContent = t.title;
  pDesc.textContent = t.desc || '';
  chaptersEl.innerHTML = '';
  (t.chapters || []).forEach(ch => {
    const c = document.createElement('div');
    c.className = 'chapter';
    c.innerHTML = `<div class="time">${ch.t}</div><div class="note">${escapeHtml(ch.note||'')}</div>`;
    c.onclick = () => { audio.currentTime = ch.s; audio.play().catch(()=>{}); };
    chaptersEl.appendChild(c);
  });

  yandexBtn.onclick = () => openLink(t.yandex);
  spotifyBtn.onclick = () => openLink(t.spotify);

  // если человек в другом разделе — можно мягко вести в Player, но не обязательно
}

function prev(){
  if (!TRACKS.length) return;
  idx = (idx <= 0) ? TRACKS.length - 1 : idx - 1;
  playTrackById(TRACKS[idx].id);
}
function next(){
  if (!TRACKS.length) return;
  idx = (idx >= TRACKS.length - 1) ? 0 : idx + 1;
  playTrackById(TRACKS[idx].id);
}

prevBtn.onclick = prev;
nextBtn.onclick = next;

toggleBtn.onclick = () => {
  if (!audio.src){
    playTrackById(TRACKS[0].id);
    return;
  }
  if (audio.paused){ audio.play().catch(()=>{}); toggleBtn.textContent='Pause'; }
  else { audio.pause(); toggleBtn.textContent='Play'; }
};

audio.addEventListener('pause', () => toggleBtn.textContent='Play');
audio.addEventListener('play', () => toggleBtn.textContent='Pause');

if (searchEl){
  searchEl.addEventListener('input', () => {
    const s = searchEl.value.trim().toLowerCase();
    filtered = TRACKS.filter(t =>
      t.title.toLowerCase().includes(s) || (t.hint||'').toLowerCase().includes(s)
    );
    renderList();
  });
}

renderList();

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, (m) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[m]));
}