// subtle parallax for the whole space
let tx = 0, ty = 0, cx = 0, cy = 0;

function setTargetFromXY(x, y){
  const nx = (x / window.innerWidth) * 2 - 1;
  const ny = (y / window.innerHeight) * 2 - 1;
  tx = nx * 14; // очень тонко
  ty = ny * 10;
}

window.addEventListener('mousemove', (e) => setTargetFromXY(e.clientX, e.clientY), { passive:true });
window.addEventListener('touchmove', (e) => {
  const t = e.touches?.[0];
  if (t) setTargetFromXY(t.clientX, t.clientY);
}, { passive:true });

function raf(){
  cx += (tx - cx) * 0.06;
  cy += (ty - cy) * 0.06;
  document.documentElement.style.setProperty('--parX', `${cx.toFixed(2)}px`);
  document.documentElement.style.setProperty('--parY', `${cy.toFixed(2)}px`);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// page transition helper
function go(url){
  const p = document.querySelector('.page');
  if (p) p.classList.add('out');
  setTimeout(() => { location.href = url; }, 260);
}

window.BACKROOM_GO = go;