/* =========================
   Helpers
========================= */
function apiBase(){ return (window.API_BASE || "").trim().replace(/\/+$/, ""); }
function $(id){ return document.getElementById(id); }

function openExternal(url){
  if (!url) return;
  window.open(url, "_blank", "noreferrer");
}

/* =========================
   Stars (canvas)
========================= */
const starsCanvas = $("stars");
const sctx = starsCanvas?.getContext?.("2d", { alpha:true });

let SW=0, SH=0, DPR=1;
let stars = [];
let warp = 0, warpTarget = 0, warpHold = 0;

function resizeStars(){
  if (!starsCanvas || !sctx) return;
  DPR = Math.min(2, window.devicePixelRatio || 1);
  SW = Math.floor(window.innerWidth);
  SH = Math.floor(window.innerHeight);
  starsCanvas.width  = Math.floor(SW * DPR);
  starsCanvas.height = Math.floor(SH * DPR);
  starsCanvas.style.width  = SW + "px";
  starsCanvas.style.height = SH + "px";
  sctx.setTransform(DPR,0,0,DPR,0,0);

  const count = Math.floor((SW * SH) / 10500);
  stars = new Array(count).fill(0).map(() => ({
    x: Math.random()*SW,
    y: Math.random()*SH,
    r: 0.6 + Math.random()*1.9,
    a: 0.06 + Math.random()*0.44,
    vx: 0.08 + Math.random()*0.16,
    vy: -0.04 + Math.random()*0.14,
    tw: 0.35 + Math.random()*1.2,
    ph: Math.random()*Math.PI*2
  }));
}
window.addEventListener("resize", resizeStars);
resizeStars();

function drawStars(ts){
  if (!sctx) return;

  warp += (warpTarget - warp) * 0.10;
  if (warpTarget > 0.02) warpHold = Math.min(1.2, warpHold + 0.03);
  else warpHold = Math.max(0, warpHold - 0.06);

  const speed = 1.0 + (warpHold * warp) * 2.6;

  sctx.clearRect(0,0,SW,SH);

  for (const s of stars){
    s.x += s.vx * speed;
    s.y += s.vy * speed;

    if (s.x > SW+10) s.x = -10;
    if (s.x < -10) s.x = SW+10;
    if (s.y > SH+10) s.y = -10;
    if (s.y < -10) s.y = SH+10;

    const tw = (Math.sin(ts*0.001*s.tw + s.ph)+1)*0.5;
    const a = s.a * (0.58 + tw*0.42);

    sctx.fillStyle = `rgba(255,255,255,${a})`;
    sctx.beginPath();
    sctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
    sctx.fill();

    // subtle colored halo
    sctx.fillStyle = `rgba(0,220,255,${a*0.05})`;
    sctx.beginPath();
    sctx.arc(s.x, s.y, s.r*2.7, 0, Math.PI*2);
    sctx.fill();
  }

  requestAnimationFrame(drawStars);
}
requestAnimationFrame(drawStars);

/* =========================
   Parallax (mouse/touch)
========================= */
let tx=0, ty=0, cx=0, cy=0;
function setTarget(x,y){
  const nx = (x / window.innerWidth) * 2 - 1;
  const ny = (y / window.innerHeight) * 2 - 1;
  tx = nx * 18;
  ty = ny * 14;
}
window.addEventListener("mousemove", e => setTarget(e.clientX, e.clientY), { passive:true });
window.addEventListener("touchmove", e => {
  const t0 = e.touches?.[0];
  if (t0) setTarget(t0.clientX, t0.clientY);
}, { passive:true });

(function parLoop(){
  cx += (tx - cx) * 0.07;
  cy += (ty - cy) * 0.07;
  document.documentElement.style.setProperty("--parX", `${cx.toFixed(2)}px`);
  document.documentElement.style.setProperty("--parY", `${cy.toFixed(2)}px`);
  requestAnimationFrame(parLoop);
})();

/* =========================
   Router (pages)
========================= */
const stage = $("stage");
const navItems = [...document.querySelectorAll(".navItem")];
const pages = [...document.querySelectorAll(".page")];
const ORDER = ["library","player","game"];
let route = "library";
let transitioning = false;

function setActive(routeName){
  navItems.forEach(b => b.classList.toggle("isActive", b.dataset.route === routeName));
  pages.forEach(p => p.classList.toggle("isActive", p.dataset.page === routeName));
}

function show(routeName){
  if (transitioning) return;
  if (!ORDER.includes(routeName)) return;
  if (routeName === route) return;

  transitioning = true;

  const cur = pages.find(p => p.dataset.page === route);
  const next = pages.find(p => p.dataset.page === routeName);

  const dir = Math.sign(ORDER.indexOf(routeName) - ORDER.indexOf(route));

  // prepare
  next.classList.remove("fromLeft","fromRight");
  if (dir < 0) next.classList.add("fromLeft");
  if (dir > 0) next.classList.add("fromRight");

  // hyperspace push (smooth)
  warpTarget = 1;

  // swap active
  cur?.classList.remove("isActive");
  next.classList.add("isActive");
  navItems.forEach(b => b.classList.toggle("isActive", b.dataset.route === routeName));

  // cleanup
  requestAnimationFrame(() => next.classList.remove("fromLeft","fromRight"));

  route = routeName;
  history.replaceState(null, "", `#${routeName}`);

  setTimeout(() => {
    warpTarget = 0;
    transitioning = false;
  }, 520);
}

navItems.forEach(b => {
  b.addEventListener("click", () => show(b.dataset.route));
});

window.addEventListener("load", () => {
  const raw = (location.hash || "#library").replace(/^#/, "");
  const initial = ORDER.includes(raw) ? raw : "library";
  route = initial;
  setActive(route);
});

/* swipe */
if (stage){
  let sx=0, sy=0, sw=false;
  stage.addEventListener("touchstart", (e)=>{
    const t0 = e.touches?.[0]; if(!t0) return;
    sx = t0.clientX; sy = t0.clientY; sw = true;
  }, {passive:true});

  stage.addEventListener("touchend", (e)=>{
    if(!sw) return; sw = false;
    const t0 = e.changedTouches?.[0]; if(!t0) return;
    const dx = t0.clientX - sx;
    const dy = t0.clientY - sy;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy)*1.3){
      const i = ORDER.indexOf(route);
      const ni = dx < 0 ? Math.min(ORDER.length-1, i+1) : Math.max(0, i-1);
      show(ORDER[ni]);
    }
  }, {passive:true});
}

/* Exit: Telegram close if possible */
const exitBtn = $("exitBtn");
exitBtn?.addEventListener("click", () => {
  const tg = window.Telegram?.WebApp;
  if (tg?.close) tg.close();
  else location.href = "/"; // fallback
});

/* =========================
   API window badge
========================= */
const windowBadge = $("windowBadge");

async function fetchState(){
  const base = apiBase();
  if (!base) throw new Error("no API_BASE");
  const r = await fetch(`${base}/state`, { cache:"no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

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

const listEl = $("list");
const searchEl = $("search");

const audio = $("audio");
const mName = $("mName");
const mHint = $("mHint");

const prevBtn = $("prev");
const nextBtn = $("next");
const toggleBtn = $("toggle");

const scrub = $("scrub");
const prog = $("prog");
const knob = $("knob");

const pTitle = $("pTitle");
const pHint = $("pHint");
const pDesc = $("pDesc");
const chaptersEl = $("chapters");
const yandexBtn = $("yandexBtn");
const spotifyBtn = $("spotifyBtn");

let filtered = [...TRACKS];
let idx = -1;

/* render list */
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function renderList(){
  if (!listEl) return;
  listEl.innerHTML = "";

  filtered.forEach(tk => {
    const row = document.createElement("div");
    row.className = "item";
    row.innerHTML = `
      <div class="itemL">
        <div class="name">${escapeHtml(tk.title)}</div>
        <div class="hint">${escapeHtml(tk.hint || "")}</div>
      </div>
      <div class="itemR">
        <button class="chip" data-act="y" type="button">YANDEX</button>
        <button class="chip" data-act="s" type="button">SPOTIFY</button>
        <button class="chip primary" data-act="p" type="button">PLAY</button>
      </div>
    `;
    row.querySelector('[data-act="p"]').onclick = () => playById(tk.id);
    row.querySelector('[data-act="y"]').onclick = () => openExternal(tk.yandex);
    row.querySelector('[data-act="s"]').onclick = () => openExternal(tk.spotify);
    listEl.appendChild(row);
  });
}

function fillPlayerMeta(tk){
  if (mName) mName.textContent = tk?.title || "No track";
  if (mHint) mHint.textContent = tk?.hint || "—";
  if (pTitle) pTitle.textContent = tk?.title || "—";
  if (pHint) pHint.textContent = tk?.hint ? tk.hint : "KRAMSKOY • BACKROOM";
  if (pDesc) pDesc.textContent = tk?.desc || "Выбери трек в библиотеке.";

  if (chaptersEl){
    chaptersEl.innerHTML = "";
    (tk?.chapters || []).forEach(ch => {
      const c = document.createElement("div");
      c.className = "chapter";
      c.innerHTML = `<div class="time">${ch.t}</div><div class="note">${escapeHtml(ch.note||"")}</div>`;
      c.onclick = () => { if(!audio) return; audio.currentTime = ch.s; audio.play().catch(()=>{}); };
      chaptersEl.appendChild(c);
    });
  }

  if (yandexBtn) yandexBtn.onclick = () => openExternal(tk?.yandex);
  if (spotifyBtn) spotifyBtn.onclick = () => openExternal(tk?.spotify);
}

function playById(id){
  if (!audio) return;
  const i = TRACKS.findIndex(x => x.id === id);
  if (i === -1) return;

  idx = i;
  const tk = TRACKS[idx];

  fillPlayerMeta(tk);

  audio.src = tk.url;
  audio.play().catch(()=>{});
  syncPlayUI();

  // when start track, jump to player page? (optional: keep user where he is)
  // show("player");
}

function prev(){
  if (!TRACKS.length) return;
  idx = (idx <= 0) ? TRACKS.length - 1 : idx - 1;
  playById(TRACKS[idx].id);
}
function next(){
  if (!TRACKS.length) return;
  idx = (idx >= TRACKS.length - 1) ? 0 : idx + 1;
  playById(TRACKS[idx].id);
}

prevBtn && (prevBtn.onclick = prev);
nextBtn && (nextBtn.onclick = next);

function syncPlayUI(){
  if (!toggleBtn || !audio) return;
  toggleBtn.classList.toggle("isPlaying", !audio.paused);
}

toggleBtn?.addEventListener("click", () => {
  if (!audio) return;
  if (!audio.src){
    playById(TRACKS[0].id);
    return;
  }
  if (audio.paused) audio.play().catch(()=>{});
  else audio.pause();
  syncPlayUI();
});
audio?.addEventListener("play", syncPlayUI);
audio?.addEventListener("pause", syncPlayUI);

/* scrub */
function setProg(p){
  if (!scrub || !prog || !knob) return;
  const clamped = Math.max(0, Math.min(1, p));
  prog.style.width = `${clamped * 100}%`;
  const r = scrub.getBoundingClientRect();
  knob.style.left = `${r.width * clamped}px`;
}

audio?.addEventListener("loadedmetadata", () => setProg(0));
audio?.addEventListener("timeupdate", () => {
  if (!audio.duration) return;
  setProg(audio.currentTime / audio.duration);
});
audio?.addEventListener("ended", () => setProg(1));

if (scrub && audio){
  let dragging = false;

  function seekFromX(clientX){
    const r = scrub.getBoundingClientRect();
    const x = Math.max(0, Math.min(r.width, clientX - r.left));
    const p = r.width ? x / r.width : 0;
    setProg(p);
    if (audio.duration) audio.currentTime = p * audio.duration;
  }

  scrub.addEventListener("pointerdown", (e) => {
    dragging = true;
    scrub.setPointerCapture(e.pointerId);
    seekFromX(e.clientX);
  });
  scrub.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    seekFromX(e.clientX);
  });
  scrub.addEventListener("pointerup", (e) => {
    dragging = false;
    try{ scrub.releasePointerCapture(e.pointerId); }catch{}
  });
}

/* search */
searchEl?.addEventListener("input", () => {
  const s = searchEl.value.trim().toLowerCase();
  filtered = TRACKS.filter(tk =>
    tk.title.toLowerCase().includes(s) || (tk.hint||"").toLowerCase().includes(s)
  );
  renderList();
});

/* init */
renderList();
fillPlayerMeta(null);
