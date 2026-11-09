// localStorage wrapper. Every access is guarded: private mode or full storage
// must never break the game, it just stops remembering.
(function () {
  const P = 'pbn:';
  function get(k) {
    try { return JSON.parse(localStorage.getItem(P + k)); } catch (e) { return null; }
  }
  function set(k, v) {
    try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) { /* ignore */ }
  }

  PBN.store = {
    get, set,
    // Uploaded pictures keep their progress in IndexedDB (see db.js).
    loadProgress(id, sig) {
      if (PBN.userArt && PBN.userArt.has(id)) return PBN.userArt.loadProgress(id, sig);
      const p = get('progress:' + id);
      return new Set(p && p.sig === sig ? p.filled : []);
    },
    saveProgress(id, sig, filled, total) {
      if (PBN.userArt && PBN.userArt.has(id)) return PBN.userArt.saveProgress(id, sig, filled, total);
      set('progress:' + id, { sig, filled: Array.from(filled), total, updated: Date.now() });
    },
    clearProgress(id) {
      if (PBN.userArt && PBN.userArt.has(id)) return PBN.userArt.clearProgress(id);
      try { localStorage.removeItem(P + 'progress:' + id); } catch (e) { /* ignore */ }
    },
    getSetting(name, fallback) {
      const s = get('settings') || {};
      return name in s ? s[name] : fallback;
    },
    setSetting(name, value) {
      const s = get('settings') || {};
      s[name] = value;
      set('settings', s);
    },
  };
})();
