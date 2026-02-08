const container = document.getElementById('tracks');

function safeLink(url){
  return (typeof url === 'string' && url.startsWith('http')) ? url : null;
}

async function load(){
  const r = await fetch(`${window.API_BASE}/tracks`, { cache: 'no-store' });
  if (!r.ok) {
    container.innerHTML = `<div class="card"><div class="title">CLOSED</div><div class="note">Вход закрыт.</div></div>`;
    return;
  }
  const data = await r.json();
  const items = data.tracks || [];

  container.innerHTML = items.map(t => {
    const s = [];
    const sp = safeLink(t.links?.spotify);
    const ap = safeLink(t.links?.apple);
    const yt = safeLink(t.links?.youtube);
    if (sp) s.push(`<a class="link" href="${sp}" target="_blank" rel="noreferrer">Spotify</a>`);
    if (ap) s.push(`<a class="link" href="${ap}" target="_blank" rel="noreferrer">Apple</a>`);
    if (yt) s.push(`<a class="link" href="${yt}" target="_blank" rel="noreferrer">YouTube</a>`);

    return `
      <div class="card">
        <div class="title">${t.title || 'Track'}</div>
        <audio controls preload="none" src="${t.audioUrl || ''}"></audio>
        ${s.length ? `<div class="links">${s.join('')}</div>` : ''}
        ${t.note ? `<div class="note">${t.note}</div>` : ''}
      </div>
    `;
  }).join('');
}

load().catch(() => {
  container.innerHTML = `<div class="card"><div class="title">offline</div></div>`;
});
