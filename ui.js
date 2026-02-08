/* =========================
   BACKROOM UI (v12) — one file, clean
========================= */

(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];

  /* ===== DOM ===== */
  const stage   = $("#stage");
  const pages   = $$(".page");
  const navBtns = $$(".navItem");
  const exitBtn = $("#exitBtn");

  const listEl   = $("#list");
  const searchEl = $("#search");

  const pTitle   = $("#pTitle");
  const pArtist  = $("#pArtist");
  const pDesc    = $("#pDesc");
  const chaptersEl = $("#chapters");
  const yandexBtn = $("#yandexBtn");
  const spotifyBtn = $("#spotifyBtn");
  const windowBadge = $("#windowBadge");

  const mini   = $("#mini");
  const scrub  = $("#scrub");
  const prog   = $("#prog");
  const knob   = $("#knob");
  const mName  = $("#mName");
  const mHint  = $("#mHint");
  const prevBtn = $("#prev");
  const nextBtn = $("#next");
  const toggleBtn = $("#toggle");
  const ctrlsEl = $("#miniCtrls") || $(".miniCtrls");
  const audio  = $("#audio");

  /* ===== ROUTER ===== */
  const ORDER = ["home","library","player","game"];
  let route = "home";
  let transitioning = false;

  // ensure data-label exists for CSS pseudo effects (if used)
  navBtns.forEach(b => {
    if (!b.dataset.label) b.dataset.label = (b.textContent || "").trim();
  });

  function pageBy(name){ return pages.find(p => p.dataset.page === name); }

  function setActiveNav(name){
    navBtns.forEach(b => {
      const on = b.dataset.route === name;
      b.classList.toggle("isActive", on);
      if (on) b.setAttribute("aria-current","page");
      else b.removeAttribute("aria-current");
    });
  }

  function show(name, dir=0){
    if (!ORDER.includes(name)) return;
    if (transitioning) return;
    if (name === route) return;

    const cur = pageBy(route);
    const next = pageBy(name);
    if (!next) return;

    transitioning = true;

    // star-warp kick on transition
    warpKick();

    // prepare next
    next.style.display = "flex";
    next.classList.add("isEntering");
    next.classList.remove("isLeaving");
    next.classList.add("isActive");

    // direction hint (optional if CSS uses it)
    next.dataset.dir = String(dir);

    // animate: current leaves
    if (cur){
      cur.classList.add("isLeaving");
      cur.classList.remove("isEntering");
      cur.classList.remove("isActive");
    }

    // after transition
    setTimeout(() => {
      if (cur){
        cur.classList.remove("isLeaving");
        cur.style.display = ""; // let CSS handle
      }
      next.classList.remove("isEntering");
      next.dataset.dir = "";
      route = name;
      setActiveNav(route);
      history.replaceState(null, "", `#${route}`);
      transitioning = false;
    }, 520);
  }

  function initRoute(){
    const raw = (location.hash || "#home").replace(/^#/, "");
    const r = ORDER.includes(raw) ? raw : "home";
    route = r;
    pages.forEach(p => p.classList.toggle("isActive", p.dataset.page === route));
    setActiveNav(route);
  }

  navBtns.forEach(b => {
    b.addEventListener("click", () => {
      const to = b.dataset.route;
      const dir = Math.sign(ORDER.indexOf(to) - ORDER.indexOf(route));
      show(to, dir);
    });
  });

  $$("[data-go]").forEach(b => {
    b.addEventListener("click", () => {
      const to = b.dataset.go;
      const dir = Math.sign(ORDER.indexOf(to) - ORDER.indexOf(route));
      show(to, dir);
    });
  });

  // swipe on stage
  let sx=0, sy=0, swiping=false;
  stage?.addEventListener("touchstart", (e)=>{
    const t = e.touches?.[0];
    if (!t) return;
    sx = t.clientX; sy = t.clientY; swiping = true;
  }, {passive:true});

  stage?.addEventListener("touchend", (e)=>{
    if (!swiping) return;
    swiping = false;
    const t = e.changedTouches?.[0];
    if (!t) return;

    const dx = t.clientX - sx;
    const dy = t.clientY - sy;

    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy)*1.35){
      const i = ORDER.indexOf(route);
      const ni = dx < 0 ? Math.min(ORDER.length-1, i+1) : Math.max(0, i-1);
      const dir = dx < 0 ? 1 : -1;
      show(ORDER[ni], dir);
    }
  }, {passive:true});

  // exit: Telegram WebApp close if possible
  exitBtn?.addEventListener("click", () => {
    if (window.Telegram?.WebApp?.close) window.Telegram.WebApp.close();
    else history.back();
  });

  /* ===== PARALLAX (gentle) ===== */
  let tx=0, ty=0, cx=0, cy=0;
  function setTargetFromXY(x,y){
    const nx = (x / window.innerWidth) * 2 - 1;
    const ny = (y / window.innerHeight) * 2 - 1;
    tx = nx * 18;
    ty = ny * 14;
  }
  window.addEventListener("mousemove", e => setTargetFromXY(e.clientX, e.clientY), {passive:true});
  window.addEventListener("touchmove", e => {
    const t = e.touches?.[0];
    if (t) setTargetFromXY(t.clientX, t.clientY);
  }, {passive:true});

  function rafPar(){
    cx += (tx - cx) * 0.07;
    cy += (ty - cy) * 0.07;
    document.documentElement.style.setProperty("--parX", `${cx.toFixed(2)}px`);
    document.documentElement.style.setProperty("--parY", `${cy.toFixed(2)}px`);
    requestAnimationFrame(rafPar);
  }
  requestAnimationFrame(rafPar);

  /* ===== STARS CANVAS ===== */
  const canvas = $("#stars");
  const ctx = canvas?.getContext("2d", { alpha:true });

  let W=0,H=0,DPR=1;
  let stars = [];
  let warp = 0;
  let warpVel = 0;

  function resizeStars(){
    if (!canvas || !ctx) return;
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
      r: 0.6 + Math.random()*1.6,
      a: 0.05 + Math.random()*0.35,
      vx: 0.10 + Math.random()*0.14,
      vy: -0.04 + Math.random()*0.12,
      tw: 0.35 + Math.random()*1.2,
      ph: Math.random()*Math.PI*2
    }));
  }

  function warpKick(){
    // smooth “push”, then decay
    warpVel = Math.min(1.25, warpVel + 0.55);
  }

  function drawStars(ts){
    if (!ctx) return;

    // decay warpVel smoothly
    warpVel += (0 - warpVel) * 0.06;
    warp += (warpVel - warp) * 0.12;

    const speed = 1.0 + warp * 2.6;

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

      // faint neon halo
      ctx.fillStyle = `rgba(0,220,255,${a*0.06})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r*2.8, 0, Math.PI*2);
      ctx.fill();
    }

    requestAnimationFrame(drawStars);
  }

  window.addEventListener("resize", resizeStars);
  resizeStars();
  requestAnimationFrame(drawStars);

  /* ===== API state badge ===== */
  function apiBase(){
    return (window.API_BASE || "").trim().replace(/\/+$/, "");
  }
  async function fetchState(){
    const r = await fetch(`${apiBase()}/state`, { cache:"no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  async function pollState(){
    try{
      const st = await fetchState();
      if (windowBadge) windowBadge.textContent = `window: ${st.windowId}`;
    }catch{}
  }
  setInterval(pollState, 2000);
  pollState();

  /* ===== TRACKS / LIST / PLAYER ===== */
  const TRACKS = [
    {
      id:"t1",
      title:"Track 01 (demo)",
      hint:"BACKROOM • window drop",
      artist:"KRAMSKOY • BACKROOM",
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
      artist:"KRAMSKOY • BACKROOM",
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
          <button class="smallBtn" data-act="y">YANDEX</button>
          <button class="smallBtn" data-act="s">SPOTIFY</button>
          <button class="smallBtn primary" data-act="p">PLAY</button>
        </div>
      `;
      row.querySelector('[data-act="p"]').addEventListener("click", () => playTrackById(tk.id));
      row.querySelector('[data-act="y"]').addEventListener("click", () => openLink(tk.yandex));
      row.querySelector('[data-act="s"]').addEventListener("click", () => openLink(tk.spotify));
      listEl.appendChild(row);
    });
  }

  function renderPlayerInfo(tk){
    if (!tk) return;

    if (mName) mName.textContent = tk.title;
    if (mHint) mHint.textContent = tk.hint || "—";

    if (pTitle) pTitle.textContent = tk.title;
    if (pArtist) pArtist.textContent = tk.artist || "KRAMSKOY • BACKROOM";
    if (pDesc) pDesc.textContent = tk.desc || "—";

    if (chaptersEl){
      chaptersEl.innerHTML = "";
      (tk.chapters || []).forEach(ch => {
        const c = document.createElement("div");
        c.className = "chapter";
        c.innerHTML = `<div class="time">${ch.t}</div><div class="note">${escapeHtml(ch.note||"")}</div>`;
        c.addEventListener("click", () => {
          audio.currentTime = ch.s;
          audio.play().catch(()=>{});
        });
        chaptersEl.appendChild(c);
      });
    }

    if (yandexBtn) yandexBtn.onclick = () => openLink(tk.yandex);
    if (spotifyBtn) spotifyBtn.onclick = () => openLink(tk.spotify);
  }

  function playTrackById(id){
    const i = TRACKS.findIndex(x => x.id === id);
    if (i === -1) return;
    idx = i;
    const tk = TRACKS[idx];

    audio.src = tk.url;
    audio.play().catch(()=>{});
    renderPlayerInfo(tk);
    syncPlayUI();
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

  prevBtn?.addEventListener("click", prev);
  nextBtn?.addEventListener("click", next);

  function syncPlayUI(){
    const playing = !!audio.src && !audio.paused;
    toggleBtn?.classList.toggle("isPlaying", playing);
  }

  toggleBtn?.addEventListener("click", () => {
    if (!audio.src){
      playTrackById(TRACKS[0].id);
      return;
    }
    if (audio.paused) audio.play().catch(()=>{});
    else audio.pause();
    syncPlayUI();
  });

  audio?.addEventListener("play", syncPlayUI);
  audio?.addEventListener("pause", syncPlayUI);
  audio?.addEventListener("ended", syncPlayUI);

  // search
  searchEl?.addEventListener("input", () => {
    const s = searchEl.value.trim().toLowerCase();
    filtered = TRACKS.filter(tk =>
      tk.title.toLowerCase().includes(s) ||
      (tk.hint||"").toLowerCase().includes(s)
    );
    renderList();
  });

  renderList();

  /* ===== MINI SCRUB: never overlaps controls ===== */
  function updateCtrlW(){
    if (!scrub) return;
    const w = ctrlsEl ? ctrlsEl.getBoundingClientRect().width : 170;
    scrub.style.setProperty("--ctrlW", `${Math.ceil(w + 14)}px`);
  }
  window.addEventListener("resize", updateCtrlW);
  setTimeout(updateCtrlW, 60);

  function setProg(p){
    const clamped = Math.max(0, Math.min(1, p));
    if (prog) prog.style.width = `${clamped * 100}%`;
    if (!scrub || !knob) return;

    const r = scrub.getBoundingClientRect();
    const usable = r.width; // CSS already cut right side with --ctrlW
    const x = usable * clamped;
    knob.style.left = `${x}px`;
  }

  audio?.addEventListener("loadedmetadata", () => setProg(0));
  audio?.addEventListener("timeupdate", () => {
    if (!audio.duration) return;
    setProg(audio.currentTime / audio.duration);
  });

  let dragging = false;

  function seekFromClientX(clientX){
    if (!scrub) return;
    const r = scrub.getBoundingClientRect();
    const x = Math.max(0, Math.min(r.width, clientX - r.left));
    const p = r.width ? (x / r.width) : 0;
    setProg(p);
    if (audio.duration) audio.currentTime = p * audio.duration;
  }

  scrub?.addEventListener("pointerdown", (e) => {
    dragging = true;
    scrub.setPointerCapture(e.pointerId);
    seekFromClientX(e.clientX);
  });

  scrub?.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    seekFromClientX(e.clientX);
  });

  scrub?.addEventListener("pointerup", (e) => {
    dragging = false;
    try{ scrub.releasePointerCapture(e.pointerId); }catch{}
  });

  /* ===== INIT ===== */
  window.addEventListener("load", () => {
    initRoute();
    // make sure ctrl width is correct after fonts
    updateCtrlW();
  });

})();
