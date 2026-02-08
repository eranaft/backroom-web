/* =========================
   i18n
========================= */
const DICT = {
  ru: {
    tab_home: "Главная",
    tab_library: "Библиотека",
    tab_player: "Плеер",
    tab_game: "Игра",
    exit: "Выход",
    welcome_kicker: "Приветствие",
    welcome_sub:
      "Ночная комната. Строго. Мрачно. Живой неон — только по граням.\nЗдесь ты слушаешь музыку и заходишь в “окна”.",
    enter: "Войти",
    open_player: "Открыть плеер",
    cass_kicker: "Кассеты",
    library_title: "Библиотека",
    search_ph: "Поиск…",
    now_kicker: "Сейчас",
    desc_title: "Описание",
    desc_empty: "Выбери трек в библиотеке.",
    chapters_title: "Тайминги",
    game_kicker: "Игра",
    in_dev: "В разработке",
    game_sub: "“Твоя победа — моя песня”.\nТут появится вход в игру и прогресс разработки.",
    back_home: "На главную",
    prev: "Назад",
    play: "Играть",
    next: "Вперёд",
    pause: "Пауза",
  },
  en: {
    tab_home: "Home",
    tab_library: "Library",
    tab_player: "Player",
    tab_game: "Game",
    exit: "Exit",
    welcome_kicker: "Welcome",
    welcome_sub:
      "Night room. Strict. Dark. Living neon only on edges.\nHere you listen and enter “windows”.",
    enter: "Enter",
    open_player: "Open player",
    cass_kicker: "Cassettes",
    library_title: "Library",
    search_ph: "Search…",
    now_kicker: "Now",
    desc_title: "Description",
    desc_empty: "Pick a track in Library.",
    chapters_title: "Timestamps",
    game_kicker: "Game",
    in_dev: "In development",
    game_sub: "“Your win — my song”.\nProgress will be here.",
    back_home: "Back home",
    prev: "Prev",
    play: "Play",
    next: "Next",
    pause: "Pause",
  }
};

function getLang(){
  const hash = new URLSearchParams((location.hash || "").replace(/^#/, ""));
  const fromHash = hash.get("lang");
  const stored = localStorage.getItem("lang");
  return (fromHash || stored || "ru").toLowerCase().startsWith("en") ? "en" : "ru";
}
let LANG = getLang();
const t = (k) => (DICT[LANG] && DICT[LANG][k]) || (DICT.ru[k] || k);

function applyI18n(){
  document.querySelectorAll("[data-i18n]").forEach(el => el.textContent = t(el.dataset.i18n));
  document.querySelectorAll("[data-i18n-ph]").forEach(el => el.setAttribute("placeholder", t(el.dataset.i18nPh)));
  document.querySelectorAll("[data-i18n='welcome_sub'],[data-i18n='game_sub']").forEach(el=>{
    el.innerHTML = t(el.dataset.i18n).replace(/\n/g, "<br/>");
  });
}
applyI18n();

/* =========================
   Router (swipe-like)
========================= */
const tabs = [...document.querySelectorAll(".tab")];
const pages = [...document.querySelectorAll(".page")];
const tabsWrap = document.querySelector(".tabs");
const stage = document.getElementById("stage");

const ORDER = ["home","library","player","game"];
let currentRoute = "home";
let transitioning = false;

function setActiveTab(route){
  tabs.forEach(b => b.classList.toggle("active", b.dataset.route === route));
  requestAnimationFrame(moveIndicatorToActive);
}

function showPage(route, dir=0){
  if (transitioning) return;
  if (!ORDER.includes(route)) return;

  const next = pages.find(p => p.dataset.page === route);
  const cur  = pages.find(p => p.dataset.page === currentRoute);
  if (!next || next === cur) return;

  transitioning = true;

  // direction classes
  next.classList.remove("from-left","from-right");
  if (dir < 0) next.classList.add("from-left");
  if (dir > 0) next.classList.add("from-right");

  // stars acceleration only
  warpTarget = 1;
  warpHold = Math.min(1.2, warpHold + 0.2);

  if (cur) cur.classList.remove("active");
  next.classList.add("active");

  // FIX: remove direction classes after start
  requestAnimationFrame(() => {
    next.classList.remove("from-left","from-right");
  });

  currentRoute = route;
  setActiveTab(route);
  history.replaceState(null, "", `#${route}`);

  setTimeout(() => {
    warpTarget = 0;
    next.classList.remove("from-left","from-right");
    transitioning = false;
  }, 560);
}

/* click tabs */
tabs.forEach(b => b.addEventListener("click", () => {
  const to = b.dataset.route;
  const dir = Math.sign(ORDER.indexOf(to) - ORDER.indexOf(currentRoute));
  showPage(to, dir);
}));

/* click buttons */
document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => {
  const to = b.dataset.go;
  const dir = Math.sign(ORDER.indexOf(to) - ORDER.indexOf(currentRoute));
  showPage(to, dir);
}));

/* init route */
window.addEventListener("load", () => {
  const raw = (location.hash || "#home").replace(/^#/, "");
  const route = raw.includes("=") ? "home" : raw;
  currentRoute = ORDER.includes(route) ? route : "home";
  pages.forEach(p => p.classList.toggle("active", p.dataset.page === currentRoute));
  setActiveTab(currentRoute);
  requestAnimationFrame(moveIndicatorToActive);
});

/* swipe on stage */
let sx=0, sy=0, swiping=false;
stage.addEventListener("touchstart", (e)=>{
  const t0 = e.touches?.[0];
  if (!t0) return;
  sx = t0.clientX; sy = t0.clientY; swiping = true;
},{passive:true});

stage.addEventListener("touchend", (e)=>{
  if (!swiping) return;
  swiping = false;
  const t0 = e.changedTouches?.[0];
  if (!t0) return;

  const dx = t0.clientX - sx;
  const dy = t0.clientY - sy;

  // only horizontal swipe
  if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy)*1.4){
    const i = ORDER.indexOf(currentRoute);
    const ni = dx < 0 ? Math.min(ORDER.length-1, i+1) : Math.max(0, i-1);
    const dir = dx < 0 ? 1 : -1;
    showPage(ORDER[ni], dir);
  }
},{passive:true});

/* =========================
   Tab indicator (smooth slide)
========================= */
let indicator = null;
if (tabsWrap){
  // FIX: не дублируем индикатор
  indicator = tabsWrap.querySelector(".tabIndicator");
  if (!indicator){
    indicator = document.createElement("span");
    indicator.className = "tabIndicator";
    tabsWrap.appendChild(indicator);
  }
}


function moveIndicatorToActive(){
  if (!indicator || !tabsWrap) return;
  const active = tabs.find(t => t.classList.contains("active")) || tabs[0];
  if (!active) return;

  const wrapRect = tabsWrap.getBoundingClientRect();
  const r = active.getBoundingClientRect();

  const left = r.left - wrapRect.left;
  indicator.style.width = `${r.width}px`;
  indicator.style.transform = `translateX(${left}px)`;
}

window.addEventListener("resize", () => requestAnimationFrame(moveIndicatorToActive));

/* =========================
   Live parallax (reactive)
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

function rafPar(){
  cx += (tx - cx) * 0.07;
  cy += (ty - cy) * 0.07;
  document.documentElement.style.setProperty("--parX", `${cx.toFixed(2)}px`);
  document.documentElement.style.setProperty("--parY", `${cy.toFixed(2)}px`);
  requestAnimationFrame(rafPar);
}
requestAnimationFrame(rafPar);

/* =========================
   Stars
========================= */
const canvas = document.getElementById("stars");
const ctx = canvas.getContext("2d", { alpha:true });

let W=0,H=0,DPR=1, stars=[];
let warp = 0;
let warpTarget = 0;
let warpHold = 0;

function resize(){
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = Math.floor(window.innerWidth);
  H = Math.floor(window.innerHeight);
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.setTransform(DPR,0,0,DPR,0,0);

  const count = Math.floor((W*H)/11000);
  stars = new Array(count).fill(0).map(() => ({
    x: Math.random()*W,
    y: Math.random()*H,
    r: 0.6 + Math.random()*1.8,
    a: 0.06 + Math.random()*0.42,
    vx: 0.10 + Math.random()*0.14,
    vy: -0.05 + Math.random()*0.12,
    tw: 0.35 + Math.random()*1.2,
    ph: Math.random()*Math.PI*2
  }));
}
window.addEventListener("resize", resize);
resize();

function drawStars(ts){
  warp += (warpTarget - warp) * 0.10;
  if (warpTarget > 0.02) warpHold = Math.min(1.25, warpHold + 0.03);
  else warpHold = Math.max(0, warpHold - 0.05);

  const speed = 1.0 + (warpHold*warp) * 3.0;

  ctx.clearRect(0,0,W,H);

  for (const s of stars){
    s.x += s.vx * speed;
    s.y += s.vy * speed;

    if (s.x > W+10) s.x = -10;
    if (s.x < -10) s.x = W+10;
    if (s.y > H+10) s.y = -10;
    if (s.y < -10) s.y = H+10;

    const tw = (Math.sin(ts*0.001*s.tw + s.ph)+1)*0.5;
    const a = s.a * (0.58 + tw*0.42);

    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
    ctx.fill();

    ctx.fillStyle = `rgba(0,220,255,${a*0.06})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r*2.8, 0, Math.PI*2);
    ctx.fill();
  }

  requestAnimationFrame(drawStars);
}
requestAnimationFrame(drawStars);

/* =========================
   API state badge
========================= */
const windowBadge = document.getElementById("windowBadge");
function apiBase(){ return (window.API_BASE || "").trim().replace(/\/+$/, ""); }
async function fetchState(){
  const r = await fetch(`${apiBase()}/state`, { cache:"no-store" });
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

/* =========================
   Audio (demo)
========================= */
const audio = document.getElementById("audio");
// ===== Mini scrub UI =====
const mini = document.getElementById("mini");

const scrub = document.createElement("div");
scrub.className = "miniScrub";
mini.appendChild(scrub);

const prog = document.createElement("div");
prog.className = "miniProgress";
mini.appendChild(prog);

const knob = document.createElement("div");
knob.className = "miniKnob";
mini.appendChild(knob);

function setProg(p){ // p 0..1
  const clamped = Math.max(0, Math.min(1, p));
  const leftPx = 12 + (mini.clientWidth - 24) * clamped;
  prog.style.width = `${clamped * 100}%`;
  knob.style.left = `${leftPx}px`;
}
audio.addEventListener("timeupdate", () => {
  if (!audio.duration) return;
  setProg(audio.currentTime / audio.duration);
});
audio.addEventListener("loadedmetadata", () => setProg(0));
audio.addEventListener("ended", () => setProg(1));




const mName = document.getElementById("mName");
const mHint = document.getElementById("mHint");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const toggleBtn = document.getElementById("toggle");

const listEl = document.getElementById("list");
const searchEl = document.getElementById("search");

const pTitle = document.getElementById("pTitle");
const pDesc = document.getElementById("pDesc");
const chaptersEl = document.getElementById("chapters");
const yandexBtn = document.getElementById("yandexBtn");
const spotifyBtn = document.getElementById("spotifyBtn");

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

let dragging = false;

function seekFromClientX(clientX){
  const r = scrub.getBoundingClientRect();
  const x = Math.max(0, Math.min(r.width, clientX - r.left));
  const p = r.width ? (x / r.width) : 0;
  setProg(p);
  if (audio.duration) audio.currentTime = p * audio.duration;
}

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
    row.className = "item glass reflectMini";
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
    row.querySelector('[data-act="p"]').onclick = () => playTrackById(tk.id);
    row.querySelector('[data-act="y"]').onclick = () => openLink(tk.yandex);
    row.querySelector('[data-act="s"]').onclick = () => openLink(tk.spotify);
    listEl.appendChild(row);
  });
}

function playTrackById(id){
  const i = TRACKS.findIndex(x => x.id === id);
  if (i === -1) return;
  idx = i;
  const tk = TRACKS[idx];

  audio.src = tk.url;
  audio.play().catch(()=>{});

  mName.textContent = tk.title;
  mHint.textContent = tk.hint || "—";

  pTitle.textContent = tk.title;
  pDesc.textContent = tk.desc || t("desc_empty");

  chaptersEl.innerHTML = "";
  (tk.chapters || []).forEach(ch => {
    const c = document.createElement("div");
    c.className = "chapter";
    c.innerHTML = `<div class="time">${ch.t}</div><div class="note">${escapeHtml(ch.note||"")}</div>`;
    c.onclick = () => { audio.currentTime = ch.s; audio.play().catch(()=>{}); };
    chaptersEl.appendChild(c);
  });

  yandexBtn.onclick = () => openLink(tk.yandex);
  spotifyBtn.onclick = () => openLink(tk.spotify);

 toggleBtn.textContent = audio.paused ? "⏵" : "⏸";

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
  if (!audio.src){ playTrackById(TRACKS[0].id); return; }
  if (audio.paused){
    audio.play().catch(()=>{});
    toggleBtn.textContent = "⏸";
  }else{
    audio.pause();
    toggleBtn.textContent = "⏵";
  }
};

audio.addEventListener("pause", () => toggleBtn.textContent = "⏵");
audio.addEventListener("play", () => toggleBtn.textContent = "⏸");

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
