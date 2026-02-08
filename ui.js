/* =========================
   Helpers
========================= */
function qs(sel, root=document){ return root.querySelector(sel); }
function qsa(sel, root=document){ return [...root.querySelectorAll(sel)]; }

function apiBase(){ return (window.API_BASE || "").trim().replace(/\/+$/, ""); }
async function fetchState(){
  const r = await fetch(`${apiBase()}/state`, { cache:"no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/* =========================
   Nav / Pages
========================= */
const ORDER = ["home","library","player","game"];
const pages = qsa(".page");
const navItems = qsa(".navItem");
const stage = qs("#stage");

let route = "home";
let transitioning = false;

function setActive(routeNext){
  navItems.forEach(b=>{
    const active = b.dataset.route === routeNext;
    b.classList.toggle("isActive", active);
    // для “обводки” через ::after нужно data-label
    b.dataset.label = b.textContent.trim();
    b.setAttribute("aria-current", active ? "page" : "false");
  });
}

function show(routeNext){
  if (transitioning) return;
  if (!ORDER.includes(routeNext)) return;
  if (routeNext === route) return;

  const cur = pages.find(p=>p.dataset.page === route);
  const nxt = pages.find(p=>p.dataset.page === routeNext);
  if (!nxt) return;

  transitioning = true;

  // плавный уход текущей
  if (cur){
    cur.classList.remove("isActive");
  }

  // небольшая задержка для “живого” blur/fade
  requestAnimationFrame(()=>{
    nxt.classList.add("isActive");
    route = routeNext;
    setActive(routeNext);

    history.replaceState(null, "", `#${routeNext}`);
    setTimeout(()=>{ transitioning = false; }, 520);
  });
}

navItems.forEach(b=>{
  b.addEventListener("click", ()=> show(b.dataset.route));
});

qsa("[data-go]").forEach(b=>{
  b.addEventListener("click", ()=> show(b.dataset.go));
});

/* swipe left-right */
let sx=0, sy=0, sw=false;
stage.addEventListener("touchstart", (e)=>{
  const t0 = e.touches?.[0];
  if (!t0) return;
  sx = t0.clientX; sy = t0.clientY; sw = true;
},{passive:true});

stage.addEventListener("touchend", (e)=>{
  if (!sw) return;
  sw = false;
  const t0 = e.changedTouches?.[0];
  if (!t0) return;
  const dx = t0.clientX - sx;
  const dy = t0.clientY - sy;
  if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy)*1.4){
    const i = ORDER.indexOf(route);
    const ni = dx < 0 ? Math.min(ORDER.length-1, i+1) : Math.max(0, i-1);
    show(ORDER[ni]);
  }
},{passive:true});

/* init from hash */
window.addEventListener("load", ()=>{
  const raw = (location.hash || "#home").replace(/^#/, "");
  route = ORDER.includes(raw) ? raw : "home";
  pages.forEach(p=> p.classList.toggle("isActive", p.dataset.page === route));
  setActive(route);
});

/* =========================
   Exit (Telegram friendly)
========================= */
const exitBtn = qs("#exitBtn");
if (exitBtn){
  exitBtn.addEventListener("click", ()=>{
    // если это Telegram WebApp — закрываем мини-апп
    if (window.Telegram?.WebApp){
      window.Telegram.WebApp.close();
      return;
    }
    // иначе просто назад
    history.back();
  });
}

/* =========================
   Live parallax
========================= */
let tx=0, ty=0, cx=0, cy=0;
function setTargetFromXY(x,y){
  const nx = (x / window.innerWidth) * 2 - 1;
  const ny = (y / window.innerHeight) * 2 - 1;
  tx = nx * 18;
  ty = ny * 14;
}
window.addEventListener("mousemove", e => setTargetFromXY(e.clientX, e.clientY), { passive:true });
window.addEventListener("touchmove", e => {
  const t0 = e.touches?.[0];
  if (t0) setTargetFromXY(t0.clientX, t0.clientY);
}, { passive:true });

(function rafPar(){
  cx += (tx - cx) * 0.07;
  cy += (ty - cy) * 0.07;
  document.documentElement.style.setProperty("--parX", `${cx.toFixed(2)}px`);
  document.documentElement.style.setProperty("--parY", `${cy.toFixed(2)}px`);
  requestAnimationFrame(rafPar);
})();

/* =========================
   Stars (random, мягкое движение)
========================= */
const canvas = qs("#stars");
const ctx = canvas.getContext("2d", { alpha:true });

let W=0,H=0,DPR=1, stars=[];
let warp=0, warpTarget=0;

function resize(){
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = Math.floor(window.innerWidth);
  H = Math.floor(window.innerHeight);
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.setTransform(DPR,0,0,DPR,0,0);

  const count = Math.floor((W*H)/9000);
  stars = new Array(count).fill(0).map(() => {
    const depth = Math.random(); // 0..1
    return {
      x: Math.random()*W,
      y: Math.random()*H,
      r: 0.4 + Math.random()*1.6,
      a: 0.05 + Math.random()*0.35,
      vx: (0.04 + Math.random()*0.12) * (0.35 + depth*1.25),
      vy: (-0.05 + Math.random()*0.10) * (0.35 + depth*1.25),
      tw: 0.35 + Math.random()*1.2,
      ph: Math.random()*Math.PI*2,
      d: depth
    };
  });
}
window.addEventListener("resize", resize);
resize();

function drawStars(ts){
  // лёгкое ускорение в переходах (если захочешь потом — подключим к роутеру)
  warp += (warpTarget - warp) * 0.08;
  const speed = 1.0 + warp * 1.8;

  ctx.clearRect(0,0,W,H);

  for (const s of stars){
    s.x += s.vx * speed;
    s.y += s.vy * speed;

    if (s.x > W+12) s.x = -12;
    if (s.x < -12) s.x = W+12;
    if (s.y > H+12) s.y = -12;
    if (s.y < -12) s.y = H+12;

    const tw = (Math.sin(ts*0.001*s.tw + s.ph)+1)*0.5;
    const a = s.a * (0.62 + tw*0.38);

    // белая точка + мягкий ореол (без “воды”)
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
    ctx.fill();

    ctx.fillStyle = `rgba(0,220,255,${a*0.05})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r*2.6, 0, Math.PI*2);
    ctx.fill();
  }

  requestAnimationFrame(drawStars);
}
requestAnimationFrame(drawStars);

/* =========================
   API badge
========================= */
const windowBadge = qs("#windowBadge");
async function poll(){
  try{
    const st = await fetchState();
    if (windowBadge) windowBadge.textContent = `window: ${st.windowId}`;
  }catch{}
}
setInterval(poll, 2000);
poll();

/* =========================
   Tracks + Player
========================= */
const audio = qs("#audio");

const mName = qs("#mName");
const mHint = qs("#mHint");
const prevBtn = qs("#prev");
const nextBtn = qs("#next");
const toggleBtn = qs("#toggle");

const listEl = qs("#list");
const searchEl = qs("#search");

const pTitle = qs("#pTitle");
const pDesc = qs("#pDesc");
const pArtist = qs("#pArtist");
const chaptersEl = qs("#chapters");
const yandexBtn = qs("#yandexBtn");
const spotifyBtn = qs("#spotifyBtn");

const scrub = qs("#scrub");
const prog = qs("#prog");
const knob = qs("#knob");

const TRACKS = [
  {
    id:"t1",
    title:"Track 01 (demo)",
    hint:"BACKROOM • window drop",
    url:"/tracks/demo.mp3",
    yandex:"https://music.yandex.ru/",
    spotify:"https://open.spotify.com/",
    desc:"Мини-описание трека.\nЗдесь будут твои заметки и смысл.",
    chapters:[
      { t:"00:00", s:0, note:"Intro" },
      { t:"00:18", s:18, note:"Verse" },
      { t:"00:52", s:52, note:"Hook" },
    ]
  },
  {
    id:"t2",
    title:"Track 02 (demo)",
    hint:"neon room",
    url:"/tracks/demo.mp3",
    yandex:"https://music.yandex.ru/",
    spotify:"https://open.spotify.com/",
    desc:"Описание второго трека.\nТемнее, глубже.",
    chapters:[
      { t:"00:00", s:0, note:"Start" },
      { t:"00:40", s:40, note:"Drop" },
    ]
  },
];

let filtered = [...TRACKS];
let idx = -1;

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}
function openLink(url){
  if (!url) return;
  window.open(url, "_blank", "noreferrer");
}

function renderList(){
  if (!listEl) return;
  listEl.innerHTML = "";
  filtered.forEach(tk => {
    const row = document.createElement("div");
    row.className = "item glassInner";
    row.innerHTML = `
      <div class="itemL">
        <div class="name">${escapeHtml(tk.title)}</div>
        <div class="hint">${escapeHtml(tk.hint || "")}</div>
      </div>
      <div class="itemR">
        <button class="smallBtn" data-act="y">Yandex</button>
        <button class="smallBtn" data-act="s">Spotify</button>
        <button class="smallBtn primary" data-act="p">Play</button>
      </div>
    `;
    row.querySelector('[data-act="p"]').onclick = () => playTrackById(tk.id, true);
    row.querySelector('[data-act="y"]').onclick = () => openLink(tk.yandex);
    row.querySelector('[data-act="s"]').onclick = () => openLink(tk.spotify);
    listEl.appendChild(row);
  });
}

function setMini(tk){
  if (mName) mName.textContent = tk?.title || "No track";
  if (mHint) mHint.textContent = tk?.hint || "—";
}
function setPlayerInfo(tk){
  if (pTitle) pTitle.textContent = tk?.title || "—";
  if (pArtist) pArtist.textContent = "KRAMSKOY • BACKROOM";
  if (pDesc) pDesc.textContent = tk?.desc || "Выбери трек в библиотеке.";

  if (chaptersEl){
    chaptersEl.innerHTML = "";
    (tk?.chapters || []).forEach(ch=>{
      const c = document.createElement("div");
      c.className = "chapter";
      c.innerHTML = `<div class="time">${ch.t}</div><div class="note">${escapeHtml(ch.note||"")}</div>`;
      c.onclick = () => { audio.currentTime = ch.s; audio.play().catch(()=>{}); };
      chaptersEl.appendChild(c);
    });
  }

  if (yandexBtn) yandexBtn.onclick = () => openLink(tk?.yandex);
  if (spotifyBtn) spotifyBtn.onclick = () => openLink(tk?.spotify);
}

function syncPlayUI(){
  if (!toggleBtn) return;
  if (audio.paused) toggleBtn.classList.remove("isPlaying");
  else toggleBtn.classList.add("isPlaying");
}

function playTrackById(id, autostart=false){
  const i = TRACKS.findIndex(x => x.id === id);
  if (i === -1) return;
  idx = i;
  const tk = TRACKS[idx];

  // не дергаем UI: сначала обновим тексты, потом play
  setMini(tk);
  setPlayerInfo(tk);

  if (audio.src !== location.origin + tk.url && audio.src !== tk.url){
    audio.src = tk.url;
  }

  if (autostart){
    audio.play().catch(()=>{});
  }
  syncPlayUI();
}

function prev(){
  if (!TRACKS.length) return;
  idx = (idx <= 0) ? TRACKS.length - 1 : idx - 1;
  playTrackById(TRACKS[idx].id, true);
}
function next(){
  if (!TRACKS.length) return;
  idx = (idx >= TRACKS.length - 1) ? 0 : idx + 1;
  playTrackById(TRACKS[idx].id, true);
}

if (prevBtn) prevBtn.onclick = prev;
if (nextBtn) nextBtn.onclick = next;

if (toggleBtn){
  toggleBtn.onclick = () => {
    if (!audio.src){
      playTrackById(TRACKS[0].id, true);
      return;
    }
    if (audio.paused) audio.play().catch(()=>{});
    else audio.pause();
    syncPlayUI();
  };
}

audio.addEventListener("play", syncPlayUI);
audio.addEventListener("pause", syncPlayUI);

/* Progress */
function setProg(p){
  const clamped = Math.max(0, Math.min(1, p));
  if (prog) prog.style.width = `${clamped * 100}%`;

  if (knob && scrub){
    const r = scrub.getBoundingClientRect();
    const usable = Math.max(0, (r.width - 160)); // не лезем на кнопки
    const x = usable * clamped;
    knob.style.left = `${x}px`;
  }
}

audio.addEventListener("loadedmetadata", () => setProg(0));
audio.addEventListener("timeupdate", () => {
  if (!audio.duration) return;
  setProg(audio.currentTime / audio.duration);
});
audio.addEventListener("ended", () => setProg(1));

let dragging = false;
function seekFromClientX(clientX){
  if (!scrub) return;
  const r = scrub.getBoundingClientRect();
  const usable = Math.max(0, (r.width - 160)); // зона до кнопок
  const x = Math.max(0, Math.min(usable, clientX - r.left));
  const p = usable ? (x / usable) : 0;
  setProg(p);
  if (audio.duration) audio.currentTime = p * audio.duration;
}

if (scrub){
  scrub.addEventListener("pointerdown", (e) => {
    dragging = true;
    scrub.setPointerCapture(e.pointerId);
    seekFromClientX(e.clientX);
  });
  scrub.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    seekFromClientX(e.clientX);
  });
  scrub.addEventListener("pointerup", (e) => {
    dragging = false;
    try{ scrub.releasePointerCapture(e.pointerId); }catch{}
  });
}

/* Search */
if (searchEl){
  searchEl.addEventListener("input", () => {
    const s = searchEl.value.trim().toLowerCase();
    filtered = TRACKS.filter(tk =>
      tk.title.toLowerCase().includes(s) || (tk.hint||"").toLowerCase().includes(s)
    );
    renderList();
  });
}

renderList();
setMini(null);
setPlayerInfo(null);
