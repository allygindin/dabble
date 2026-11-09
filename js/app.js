// App bootstrap: lock page-level gestures, then open the game.
(function () {
  // Keep Safari from zooming/scrolling the page itself. Pinch-zoom happens
  // only inside the artwork (handled in panzoom.js with pointer events).
  const prevent = (e) => e.preventDefault();
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((t) => document.addEventListener(t, prevent, { passive: false }));
  document.addEventListener('touchmove', (e) => {
    const t = e.target;
    if (!(t && t.closest && t.closest('.scrollable'))) e.preventDefault();
  }, { passive: false });
  document.addEventListener('dblclick', prevent, { passive: false });
  document.addEventListener('contextmenu', prevent);

  const app = document.getElementById('app');
  let current = null;

  function openArt(art) {
    if (current) current.destroy();
    app.innerHTML = '';
    current = PBN.Game(app, art, {});
  }

  openArt(PBN.artworks[0]);
})();
