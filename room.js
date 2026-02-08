const nowEl = document.getElementById('nowPlaying');
const dropsEl = document.getElementById('drops');
const metaEl = document.getElementById('roomMeta');
const statusEl = document.getElementById('roomStatus');
const shell = document.getElementById('shell');

function safeLink(url){
  return (typeof url === 'string' && url.startsWith('http')) ? url : null;
}

function trackCard(t, {compact=false} = {}){
  const links = [];
  const sp = safeLink(t.links?.spotify);
  const ap = safeLink(t.links?.apple);
  const yt = safeLink(t.links?.youtube);
  if (sp) links.push(`<a class="link" href="${sp}" target="_blank" rel="noreferrer">Spotify</a>`);
  if (ap) links.push(`<a class="link" href="${ap}" target="_blank" rel="noreferrer">Apple</a>`);
  if (yt) links.push(`<a class="link" href="${yt}" target="_blank" rel="noreferrer">YouTube</a>`);

  const audio = t.audioUrl ? `<audio controls preload="none" src="${t.audioUrl}"></audio>` : '';

  return `
    <div class="drop">
      <div class="dropTitle">${t.title || 'Track'}</div>
      ${compact ? '' : audio}
      ${links.length ? `<div class="links">${links.join('')}</div>` : ''}
      ${t.note ? `<div class="note">${t.note}</div>` : ''}
    </div>
  `;
}

async function fetchState(){
  const r = await fetch(`${window.API_BASE}/state`, { cache: 'no-store' });
  return r.json();
}

async function fetchTracks(){
  const r = await fetch(`${window.API_BASE}/tracks`, { cache: 'no-store' });
  if (!r.ok) throw new Error('CLOSED');
  return r.json();
}

async function render(){
  // статус окна
  const st = await fetchState();
  metaEl.textContent = `window: ${st.windowId}`;
  statusEl.textContent = st.isOpen ? 'OPEN' : 'CLOSED';

  if (!st.isOpen){
    nowEl.innerHTML = `<div class="drop"><div class="dropTitle">CLOSED</div><div class="note">Вход закрыт.</div></div>`;
    dropsEl.innerHTML = '';
    return;
  }

  // треки
  const data = await fetchTracks();
  const tracks = data.tracks || [];
  if (!tracks.length){
    nowEl.innerHTML = `<div class="drop"><div class="dropTitle">EMPTY</div><div class="note">Пока ничего.</div></div>`;
    dropsEl.innerHTML = '';
    return;
  }

  // NOW PLAYING = первый трек
  const first = tracks[0];
  nowEl.innerHTML = `
    <div class="drop">
      <div class="dropTitle">${first.title || 'Track'}</div>
      ${first.audioUrl ? `<audio controls autoplay preload="metadata" src="${first.audioUrl}"></audio>` : ''}
      ${(safeLink(first.links?.spotify) || safeLink(first.links?.apple) || safeLink(first.links?.youtube))
        ? `<div class="links">
            ${safeLink(first.links?.spotify) ? `<a class="link" href="${first.links.spotify}" target="_blank" rel="noreferrer">Spotify</a>` : ``}
            ${safeLink(first.links?.apple) ? `<a class="link" href="${first.links.apple}" target="_blank" rel="noreferrer">Apple</a>` : ``}
            ${safeLink(first.links?.youtube) ? `<a class="link" href="${first.links.youtube}" target="_blank" rel="noreferrer">YouTube</a>` : ``}
          </div>` : ``}
      ${first.note ? `<div class="note">${first.note}</div>` : ''}
    </div>
  `;

  // DROPS = остальные
  const rest = tracks.slice(1);
  dropsEl.innerHTML = rest.map(t => trackCard(t)).join('') || `<div class="drop"><div class="note">No extra drops.</div></div>`;
}

// простая “3D-живость” от движения пальца/мыши
function attachParallax(){
  const strength = 8; // больше = агрессивнее

  function onMove(x, y){
    const r = shell.getBoundingClientRect();
    const nx = (x - (r.left + r.width/2)) / (r.width/2);
    const ny = (y - (r.top + r.height/2)) / (r.height/2);
    const rx = (-ny * strength).toFixed(2);
    const ry = (nx * strength).toFixed(2);
    shell.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
  }

  window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY), { passive:true });
  window.addEventListener('touchmove', (e) => {
    const t = e.touches?.[0];
    if (t) onMove(t.clientX, t.clientY);
  }, { passive:true });

  window.addEventListener('mouseleave', () => {
    shell.style.transform = `rotateX(0deg) rotateY(0deg) translateZ(0)`;
  });
}

render().catch(() => {
  nowEl.innerHTML = `<div class="drop"><div class="dropTitle">offline</div><div class="note">Сервер недоступен.</div></div>`;
  dropsEl.innerHTML = '';
});

attachParallax();
