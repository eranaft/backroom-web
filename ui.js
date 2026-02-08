/* =========================
   i18n (RU now, EN ready)
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

function t(key){
  return (DICT[LANG] && DICT[LANG][key]) || (DICT.ru[key] || key);
}

function applyI18n(){
  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-ph]").forEach(el => {
    el.setAttribute("placeholder", t(el.dataset.i18nPh));
  });

  // multiline subtitles
  document.querySelectorAll("[data-i18n='welcome_sub'],[data-i18n='game_sub']").forEach(el=>{
    el.innerHTML = t(el.dataset.i18n).replace(/\n/g, "<br/>");
  });
}

applyI18n();

/* =========================
   Router + transitions
========================= */
const tabs = [...document.querySelectorAll(".tab")];
const pages = [...document.querySelectorAll(".page")];
const flash = document.getElementById("neonFlash");

let transitioning = false;

function setActiveTab(route){
  tabs.forEach(b => b.classList.toggle("active", b.dataset.route === route));
}

function showPage(route){
  if (transitioning) return;
  const next = pages.find(p => p.dataset.page === route);
  const cur = pages.find(p => p.classList.contains("active"));
  if (!next || next === cur) return;

  transitioning = true;
  document.body.classList.add("is-transitioning");

  // Drive warp for stars acceleration smoothly
  boostWarp(1.0); // starts ramp

  // switch pages with extra time for animation
  if (cur) cur.classList.remove("active");
  next.classList.add("active");

  setActiveTab(route);
  history.replaceState(null, "", `#${route}`);

  // end transition
  setTimeout(() => {
    document.body.classList.remove("is-transitioning");
    boostWarp(0); // ramp down
    transitioning = false;
  }, 620);
}

tabs.forEach(b => b.addEventListener("click", () => showPage(b.dataset.route)));
document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => showPage(b.dataset.go)));

window.addEventListener("load", () => {
  const r = (location.hash || "#home").replace(/^#/, "");
  // allow "#lang=en" etc
  const route = r.includes("=") ? "home" : r;
  showPage(route || "home");
});

/* =========================
   Parallax (subtle)
========================= */
let tx=0, ty=0, cx=0, cy=0;
function setTargetFromXY(x,y){
  const nx = (x / window.innerWidth) * 2 - 1;
  const ny = (y / window.innerHeight) * 2 - 1;
  tx = nx * 16;
  ty = ny * 12;
}
window.addEventListener("mousemove", e => setTargetFromXY(e.clientX, e.clientY), { passive:true });
window.addEventListener("touchmove", e => {
  const t = e.touches?.[0];
  if (t) setTargetFromXY(t.clientX, t.clientY);
}, { passive:true });

function rafPar(){
  cx += (tx - cx) * 0.06;
  cy += (ty - cy) * 0.06;
  document.documentElement.style.setProperty("--parX", `${cx.toFixed(2)}px`);
  document.documentElement.style.setProperty("--parY", `${cy.toFixed(2)}px`);
  requestAnimationFrame(rafPar);
}
requestAnimationFrame(rafPar);

/* =========================
   Stars with warp accel (smooth)
========================= */
const canvas = document.getElementById("stars");
const ctx = canvas.getContext("2d", { alpha:true });

let W=0,H=0,DPR=1, stars=[];
let warp = 0;        // current 0..1.6
let warpTarget = 0;  // target
let warpHold = 0;    // grows while target >0

function boostWarp(v){
  warpTarget = v; // 0 or 1
}

function resize(){
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = Math.floor(window.innerWidth);
  H = Math.floor(window.innerHeight);
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.setTransform(DPR,0,0,DPR,0,0);

  const count = Math.floor((W*H)/12000); // чуть больше звёзд = больше “пространства”
  stars = new Array(count).fill(0).map(() => ({
    x: Math.random()*W,
    y: Math.random()*H,
    r: 0.6 + Math.random()*1.7,
    a: 0.08 + Math.random()*0.42,
    vx: 0.10 + Math.random()*0.12,
    vy: -0.04 + Math.random()*0.10,
    tw: 0.35 + Math.random()*1.2,
    ph: Math.random()*Math.PI*2
  }));
}
window.addEventListener("resize", resize);
resize();

function drawStars(ts){
  // warp ramps smooth, with hold to create “acceleration feeling”
  warp += (warpTarget - warp) * 0.08;
  if (warpTarget > 0.01) warpHold = Math.min(1.6, warpHold + 0.03);
  else warpHold = Math.max(0, warpHold - 0.05);

  const warpMix = Math.min(1.6, warpHold) * warp; // 0..1.6
  document.documentElement.style.setProperty("--warp", warpMix.toFixed(3));

  ctx.clearRect(0,0,W,H);

  // base drift + warp accel (no tunnel, just faster drift)
  const speed = 1.0 + warpMix * 3.2;

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

    // nuclear neon halo (subtle but present)
    ctx.fillStyle = `rgba(88,242,255,${a*0.07})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r*3.0, 0, Math.PI*2);
    ctx.fill();
  }

  requestAnimationFrame(drawStars);
}
requestAnimationFrame(drawStars);

/* =========================
   Global audio (plays everywhere)
========================= */
const audio = document.getElementById("audio");
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

// demo tracks (replace later)
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

function renderList(){
  listEl.innerHTML = "";
  filtered.forEach(t => {
    const row = document.createElement("div");
    row.className = "item reflectMini";
    row.innerHTML = `
      <div class="itemL">
        <div class="name">${escapeHtml(t.title)}</div>
        <div class="hint">${escapeHtml(t.hint || "")}</div>
      </div>
      <div class="itemR">
        <button class="smallBtn neonThin" data-act="y">Yandex</button>
        <button class="smallBtn neonThin" data-act="s">Spotify</button>
        <button class="smallBtn primary neonThin" data-act="p">Play</button>
      </div>
    `;
    row.querySelector('[data-act="p"]').onclick = () => playTrackById(t.id);
    row.querySelector('[data-act="y"]').onclick = () => openLink(t.yandex);
    row.querySelector('[data-act="s"]').onclick = () => openLink(t.spotify);
    listEl.appendChild(row);
  });

  if (filtered.length === 0){
    const empty = document.createElement("div");
    empty.className = "item";
    empty.textContent = "Ничего не найдено.";
    listEl.appendChild(empty);
  }
}

function openLink(url){
  if (!url) return;
  window.open(url, "_blank", "noreferrer");
}

function playTrackById(id){
  const i = TRACKS.findIndex(x => x.id === id);
  if (i === -1) return;
  idx = i;
  const t = TRACKS[idx];

  audio.src = t.url;
  audio.play().catch(()=>{});

  mName.textContent = t.title;
  mHint.textContent = t.hint || "—";

  pTitle.textContent = t.title;
  if (pDesc) pDesc.textContent = t.desc || t(t.desc_empty);

  chaptersEl.innerHTML = "";
  (t.chapters || []).forEach(ch => {
    const c = document.createElement("div");
    c.className = "chapter neonThin";
    c.innerHTML = `<div class="time">${ch.t}</div><div class="note">${escapeHtml(ch.note||"")}</div>`;
    c.onclick = () => { audio.currentTime = ch.s; audio.play().catch(()=>{}); };
    chaptersEl.appendChild(c);
  });

  yandexBtn.onclick = () => openLink(t.yandex);
  spotifyBtn.onclick = () => openLink(t.spotify);

  toggleBtn.textContent = t("pause");
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
  if (audio.paused){ audio.play().catch(()=>{}); toggleBtn.textContent = t("pause"); }
  else { audio.pause(); toggleBtn.textContent = t("play"); }
};

audio.addEventListener("pause", () => toggleBtn.textContent = t("play"));
audio.addEventListener("play", () => toggleBtn.textContent = t("pause"));

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

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}
