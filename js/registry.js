// Global namespace + artwork registry. Artwork files call PBN.registerArtwork({...}).
window.PBN = window.PBN || {};
PBN.artworks = [];
PBN.registerArtwork = function (art) {
  PBN.artworks.push(art);
};
