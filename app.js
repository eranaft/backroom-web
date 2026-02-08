const statusEl = document.getElementById('status');
const timerEl = document.getElementById('timer');
const metaEl = document.getElementById('meta');
const wrapEl = document.getElementById('wrap');
const jumpFx = document.getElementById('jumpFx');

const canvas = document.getElementById('stars');
const ctx = canvas.getContext('2d', { alpha: true });

function fmt(ms){
  const s = Math.max(0, Math.floor(ms/1000));
  const hh = String(Math.floor(s/3600)).padStart(2,'0');
  const mm = String(Math.floor((s%3600)/60)).padStart(2,'0');
  const ss = String(s%60).padStart(2,'0');
  return `${hh}:${mm}:${ss}`;
}

let lastState = null;

function apiBase(){
  return (window.API_BASE || '').trim().replace(/\/+$/, '');
}

async function fetchState(){
  const base = apiBase();
  const r = await fetch(`${base}/state`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status} /state`);
  return r.json();
}

function render(st){
  lastState = st;
  document.body.classList.toggle('is-closed', !st.isOpen);

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

async function tick(){
  try{
    const st = await fetchState();
    render(st);

    if (!st.isOpen && st.reopenAt){
      const target = new Date(st.reopenAt).getTime();
      timerEl.textContent = fmt(target - Date.now());
    }
  }catch(e){
    metaEl.textContent = `offline: ${String(e.message || e)}`;
  }
}

/* ========= Управление эффектами =========
   Движение/наклон/ускорение: ТОЛЬКО когда держим OPEN
*/
let hoveringOpen = false;
let hold = 0;          // 0..1.6
let warp = 0;          // 0..1
let tiltX = 0, tiltY = 0;
let lastTs = performance.now();

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function smoothstep(t){ return t*t*(3-2*t); }

function setVars(){
  document.body.style.setProperty('--warp', warp.toFixed(3));

  // наклон — только если hover OPEN, иначе возвращаем в 0
  document.body.style.setProperty('--tiltX', `${tiltX.toFixed(2)}deg`);
  document.body.style.setProperty('--tiltY', `${tiltY.toFixed(2)}deg`);

  // ускоряем перелив ФОНА (не текста) при warp
  const baseSpeed = (lastState?.isOpen ? 18 : 26);
  const minSpeed = (lastState?.isOpen ? 8 : 22);
  const s = baseSpeed - (baseSpeed - minSpeed) * clamp(warp,0,1);
  document.body.style.setProperty('--bgSpeed', `${s.toFixed(2)}s`);

  // hue фона: чем больше warp — тем сильнее перелив
  const hue = (lastState?.isOpen ? (warp * 140) : 0);
  document.body.style.setProperty('--bgHue', `${hue.toFixed(1)}deg`);
}

function onEnter(){
  if (lastState?.isOpen) hoveringOpen = true;
}
function onLeave(){
  hoveringOpen = false;
}

/* hover только на OPEN */
statusEl.addEventListener('mouseenter', onEnter);
statusEl.addEventListener('mouseleave', onLeave);
statusEl.addEventListener('touchstart', onEnter, { passive:true });
statusEl.addEventListener('touchend', onLeave, { passive:true });
statusEl.addEventListener('touchcancel', onLeave, { passive:true });

/* Наклон — только когда держим OPEN (и только от движения пальца/мыши) */
function applyPointerTilt(x, y){
  if (!hoveringOpen) return; // <-- важно (п.3)
  const r = wrapEl.getBoundingClientRect();
  const nx = (x - (r.left + r.width/2)) / (r.width/2);
  const ny = (y - (r.top + r.height/2)) / (r.height/2);
  tiltY = clamp(nx, -1, 1) * 8;
  tiltX = clamp(-ny, -1, 1) * 6;
}

window.addEventListener('mousemove', (e) => applyPointerTilt(e.clientX, e.clientY), { passive:true });
window.addEventListener('touchmove', (e) => {
  const t = e.touches?.[0];
  if (t) applyPointerTilt(t.clientX, t.clientY);
}, { passive:true });

/* ========= Hyperspace stars (3D) ========= */
let W=0,H=0,DPR=1, CX=0,CY=0;
let stars = [];
let seedAngle = 0; // будет медленно вращать “туннель” со временем удержания

function resize(){
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = Math.floor(window.innerWidth);
  H = Math.floor(window.innerHeight);
  CX = W/2; CY = H/2;

  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  const count = Math.floor((W * H) / 14000); // плотность (можно увеличить)
  stars = new Array(count).fill(0).map(() => newStar(true));
}

function newStar(randomZ=false){
  // x,y в -1..1, z в 0..1 (глубина)
  const x = (Math.random()*2 - 1);
  const y = (Math.random()*2 - 1);
  const z = randomZ ? Math.random() : 1;
  const r = 0.6 + Math.random()*1.8;
  const a = 0.15 + Math.random()*0.55;
  return { x, y, z, r, a };
}

window.addEventListener('resize', resize);
resize();

function drawStars(dt){
  ctx.clearRect(0,0,W,H);

  const open = !!lastState?.isOpen;
  // CLOSED: звезды стоят, только плавно “дышат”
  // OPEN + hover: включаем гиперпространство
  const engaged = open && hoveringOpen;

  // плавная “дыхалка” без резкости (п.2/7)
  const breathe = 0.55 + 0.45 * Math.sin(performance.now()*0.0006);

  // скорость “вылета” по z
  const speed = engaged ? (0.25 + warp*2.8) : 0;

  // со временем удержания туннель слегка вращается (п.4)
  seedAngle += (engaged ? 0.9 : 0.15) * dt;

  const ang = seedAngle * 0.35 * (engaged ? 1 : 0.2);
  const ca = Math.cos(ang), sa = Math.sin(ang);

  for (let i=0;i<stars.length;i++){
    const s = stars[i];

    // обновляем глубину
    if (engaged){
      s.z -= speed * dt;
      if (s.z <= 0.02){
        stars[i] = newStar();
        continue;
      }
    }

    // вращаем x/y слегка, создаёт “живой туннель”
    let x = s.x, y = s.y;
    const rx = x*ca - y*sa;
    const ry = x*sa + y*ca;

    // проекция: чем меньше z, тем сильнее “разлёт” к краям (как Star Wars)
    const scale = 0.75;
    const px = CX + (rx / s.z) * (W * 0.22) * scale;
    const py = CY + (ry / s.z) * (W * 0.22) * scale;

    // если улетели за экран — пересоздаём
    if (px < -200 || px > W+200 || py < -200 || py > H+200){
      stars[i] = newStar();
      continue;
    }

    // длина “стрима” при скорости
    const streak = engaged ? (12 + warp*120) : 0;

    const alpha = s.a * (open ? 1 : 0.55) * (open ? 1 : breathe);
    const base = open ? `rgba(255,255,255,${alpha})` : `rgba(255,140,160,${alpha*0.65})`;

    if (engaged){
      // направление стрима от центра
      const dx = (px - CX);
      const dy = (py - CY);
      const len = Math.max(1, Math.sqrt(dx*dx + dy*dy));
      const ux = dx/len, uy = dy/len;

      ctx.strokeStyle = base;
      ctx.lineWidth = Math.max(1, s.r * (0.9 + warp*0.8));
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + ux*streak, py + uy*streak);
      ctx.stroke();

      // маленькая яркая точка
      ctx.fillStyle = `rgba(255,255,255,${Math.min(1, alpha*1.2)})`;
      ctx.beginPath();
      ctx.arc(px, py, s.r*0.9, 0, Math.PI*2);
      ctx.fill();
    } else {
      // спокойный режим: точки + очень мягкий glow
      ctx.fillStyle = base;
      ctx.beginPath();
      ctx.arc(px, py, s.r*0.7, 0, Math.PI*2);
      ctx.fill();

      ctx.fillStyle = open
        ? `rgba(88,242,255,${alpha*0.10})`
        : `rgba(255,90,110,${alpha*0.08})`;
      ctx.beginPath();
      ctx.arc(px, py, s.r*2.6, 0, Math.PI*2);
      ctx.fill();
    }
  }
}

/* ========= Переход OPEN -> ROOM (Star Wars jump) ========= */
let jumping = false;

statusEl.addEventListener('click', () => {
  if (!lastState?.isOpen || jumping) return;

  jumping = true;
  document.body.classList.add('jumping');

  // форсируем эффект “улёт”
  hoveringOpen = true;
  hold = 1.6;
  warp = 1;

  setVars();

  // через 720мс — в комнату
  setTimeout(() => {
    location.href = '/room.html';
  }, 720);
});

/* ========= main loop ========= */
function frame(ts){
  const dt = Math.min(0.05, (ts - lastTs)/1000);
  lastTs = ts;

  const open = !!lastState?.isOpen;
  const engaged = open && hoveringOpen;

  // hold только когда держим OPEN
  if (engaged) hold = clamp(hold + dt*0.95, 0, 1.6);
  else hold = clamp(hold - dt*1.35, 0, 1.6);

  const t = smoothstep(hold/1.6);
  const targetWarp = open ? (engaged ? clamp(0.10 + 0.90*t, 0, 1) : 0) : 0;
  warp += (targetWarp - warp) * 0.07;

  // если не engaged — наклон возвращаем к 0, чтобы не “жило” без OPEN (п.3)
  if (!engaged){
    tiltX *= 0.85;
    tiltY *= 0.85;
  }

  setVars();
  drawStars(dt);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
setInterval(tick, 1000);
tick();
