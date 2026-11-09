// App bootstrap: lock page-level gestures, switch between gallery and game.
(function () {
  // Keep Safari from zooming/scrolling the page itself. Pinch-zoom happens
  // only inside the artwork (handled in panzoom.js with pointer events);
  // elements marked .scrollable (the gallery) may still scroll.
  const prevent = (e) => e.preventDefault();
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((t) => document.addEventListener(t, prevent, { passive: false }));
  document.addEventListener('touchmove', (e) => {
    const t = e.target;
    // Leave scrollable areas and native form controls alone (cancelling a
    // Pencil tap's tiny wobble would make Safari drop the tap on a control).
    if (!(t && t.closest && t.closest('.scrollable, input, label, select, textarea'))) e.preventDefault();
  }, { passive: false });
  document.addEventListener('dblclick', prevent, { passive: false });
  document.addEventListener('contextmenu', prevent);

  const app = document.getElementById('app');
  let current = null;

  function show(make) {
    if (current) current.destroy();
    app.innerHTML = '';
    current = make();
  }
  function showGallery() {
    show(() => PBN.Gallery(app, openArt, showMyArt, showUpload));
  }
  function showMyArt() {
    show(() => PBN.MyArt(app, { onBack: showGallery, onView: viewArt }));
  }
  function viewArt(art) {
    show(() => PBN.ArtViewer(app, art, { onBack: showMyArt, onRestart: openArt }));
  }
  function showUpload() {
    show(() => PBN.Upload(app, { onBack: showGallery, onSaved: openArt }));
  }
  function openArt(art) {
    show(() => PBN.Game(app, art, { onExit: showGallery }));
  }

  // Load uploaded pictures from IndexedDB before showing anything.
  PBN.ready = (PBN.userArt.available ? PBN.userArt.init() : Promise.resolve())
    .catch((e) => console.warn('Could not load uploaded pictures', e));
  PBN.ready.then(showGallery);
})();
