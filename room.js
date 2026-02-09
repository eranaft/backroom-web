(() => {
  function apiBase() {
    return (window.API_BASE || "").trim().replace(/\/+$/, "");
  }

  async function safeJson(url) {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setWindowBadge(isOpen) {
    const badge = document.getElementById("windowBadge");
    if (!badge) return;
    badge.textContent = `window: ${isOpen ? "OPEN" : "CLOSED"}`;
  }

  async function syncLobby() {
    try {
      const st = await safeJson(`${apiBase()}/state`);
      setWindowBadge(!!st.isOpen);
    } catch (_) {
      // молча: ui.js сам может рисовать состояние
    }
  }

  async function syncCurrentTrack() {
    try {
      const cur = await safeJson(`${apiBase()}/track/current`);
      if (!cur || !cur.url) return;

      // если ui.js уже поставил трек — НЕ трогаем
      const audio = document.getElementById("audio");
      if (!audio) return;

      const already = (audio.getAttribute("src") || audio.src || "").trim();
      if (already && already.includes(cur.url)) return;

      // ставим аккуратно
      audio.src = cur.url;

      // обновляем подписи (если ui.js сам их не обновил — это просто страховка)
      setText("pTitle", cur.title || "—");
      setText("mName", cur.title || "No track");
      setText("mHint", "current");

    } catch (_) {
      // молча
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    // первый синк после загрузки
    syncLobby();
    syncCurrentTrack();

    // периодически обновляем (чтобы после загрузки трека через бота на сайте он подхватился)
    setInterval(syncLobby, 4000);
    setInterval(syncCurrentTrack, 7000);
  });
})();