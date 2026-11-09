# Dabble – color by number for iPad

A paint-by-numbers game that runs in Safari. Plain HTML, CSS and JavaScript:
no frameworks, no build step. Open `index.html` through any static web server.

## Running it

From this folder:

```sh
python3 -m http.server 8000      # plain http, fine for a Mac browser
python3 serve_https.py           # https on port 8443, needed for iPad Safari
```

iPad Safari tends to insist on `https`, so use `serve_https.py` for the iPad:
`https://<your-mac's-address>:8443`. It uses a self-signed certificate in
`.cert/` (kept out of git). The first visit shows "This Connection Is Not
Private": tap **Show Details → visit this website**.

To make a new certificate (e.g. your Mac's address changed):

```sh
mkdir -p .cert && openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
  -keyout .cert/key.pem -out .cert/cert.pem -subj "/CN=Dabble dev" \
  -addext "subjectAltName=IP:<mac-ip>,IP:127.0.0.1,DNS:localhost"
```

**Home screen:** in Safari tap Share → **Add to Home Screen**. It then opens
full-screen with its own icon.

**Saved progress** lives in the browser's local storage, separately for each
address *and* for Safari vs. the home-screen app. Switching between them
starts you fresh.

## Uploading your own photos

On the start screen tap **Upload picture**: choose a photo, crop it, pick the
number of colors (8–30) and the detail level, check the numbered preview,
then name it and give it a category. Everything happens on the iPad; the
photo is never sent anywhere.

- Conversion runs in a background worker (`js/convert.js`). Small or thin
  areas are merged into their neighbors until every area passes the tap
  rule, and palettes follow the same color rules as the checker, so you may
  get fewer colors than you asked for when a photo's shades are very close.
- Uploaded pictures and their progress are stored in IndexedDB (not
  localStorage). Like all website data, Safari may clear it if the site
  isn't used for a long time; adding the game to the home screen avoids that.
- Uploaded pictures can be deleted with the trash button on their painting
  screen.

## Adding a picture

1. Create a file in `artworks/`, e.g. `artworks/owl.js`.
2. Add one line to `index.html` next to the other artworks:
   ```html
   <script src="artworks/owl.js"></script>
   ```
3. Reload. It appears on the start screen. Pictures show in the order of
   their script tags.

### The file format

```js
PBN.registerArtwork({
  id: 'owl',                 // unique, used as the save-game key
  title: 'Night Owl',
  difficulty: 'Medium',      // 'Easy' | 'Medium' | 'Hard' (sets the badge color)
  tags: ['birds', 'night'],  // optional, lowercase words for future categories
  viewBox: [0, 0, 600, 400], // drawing coordinates: x, y, width, height
  maxZoom: 8,                // optional, how far pinch-zoom may go (default 8)
  palette: [                 // color 1, color 2, color 3 ... in this order
    ['#1D3557', 'Night'],
    ['#F1C453', 'Moon'],
    ['#8D6E63', 'Feathers'],
  ],
  regions: [                 // drawn in order: later regions sit ON TOP
    { c: 1, rect: [0, 0, 600, 400] },
    { c: 2, circle: [480, 80, 40] },
    { c: 3, ellipse: [300, 250, 70, 110] },
    { c: 3, poly: [250, 160, 270, 120, 290, 160] },
    { c: 2, d: 'M280 230 L320 230 L300 260 Z' },
  ],
});
```

Each region needs `c` (its color number) and **one** shape:

| Shape      | Value                              |
|------------|------------------------------------|
| `rect`     | `[x, y, width, height]`            |
| `circle`   | `[cx, cy, r]`                      |
| `ellipse`  | `[cx, cy, rx, ry, rotationDeg]`    |
| `poly`     | `[x1, y1, x2, y2, ...]` (closed)   |
| `d`        | any SVG path string, e.g. copied from a drawing app |

Optional: `label: [x, y, fontSize]` places that region's number by hand.
Normally numbers are placed automatically at the roomiest visible spot and
sized to fit.

### Tips

- **Layer instead of cutting out.** Regions don't need to fit together like
  puzzle pieces. Draw the sky as one big rectangle, then the hills on top,
  then the trees on top of those. Only the visible part of each region is
  tappable, and its number goes there.
- **Every region you add is one tap.** Each shape (even a tiny eye) counts.
  As a guide: easy ≈ 15, medium ≈ 40, hard ≈ 80.
- **Avoid near-white colors.** Unpainted regions are white, so a white cloud
  would look "done" before it's painted. Use a soft tint instead.
- **Neighbors with the same color** blend into one shape once painted
  (outlines take the fill color). That's handy for building one object from
  several pieces.
- Artwork files are JavaScript, so you can use helper functions for repeated
  things. See `artworks/reef.js` (fish, kelp, corals) and
  `artworks/landscape.js` (pine trees).
- **Editing a picture resets its saved progress.** Saved progress is tied to
  the exact shapes, so changing a picture starts it over rather than leaving
  wrong areas painted.

### Checking a picture

Open **`/check.html`** from the same server (e.g. `http://localhost:8000/check.html`).
It tests every picture listed in `index.html` and lists anything to fix:

- **Tap size:** at the picture's `maxZoom`, every region's visible part must
  fit a circle at least 44px across on an iPad screen (Apple's minimum tap
  size). Raise `maxZoom` or make the shape bigger/thicker if one fails.
- **Hidden regions:** a region completely covered by later regions.
- **Colors too alike:** any two palette colors must differ clearly
  (CIE ΔE ≥ 12), and none may be so pale it looks unpainted.
- **Readable swatch numbers:** a swatch number needs 4.5:1 contrast. Very
  light or fairly dark colors pass on their own; for mid-brightness colors
  the game shows the number on a white badge (the checker notes these).
- **Confusable numbers on similar shades:** two similar colors (ΔE < 25)
  must not have numbers that are easy to misread for each other at small
  sizes (1/7, 3/8, 5/6, 6/8, 8/9, 0/8, e.g. 16 and 18). Keep shade families
  together and reorder the palette if one is flagged.

## Project layout

```
index.html            page shell, script tags (artworks listed here)
manifest.json         home-screen app settings
icons/                app icons (PNG rendered from icon.svg)
css/style.css         all styling
artworks/*.js         one file per picture
js/registry.js        PBN namespace + registerArtwork()
js/shapes.js          rect/circle/... -> SVG path; artwork signature
js/store.js           localStorage (progress, settings)
js/labels.js          automatic number placement and sizing
js/panzoom.js         pinch-zoom, pan, and tap detection
js/game.js            painting screen: palette, fill rules, feedback
js/gallery.js         start screen with progress thumbnails
js/myart.js           My Art: finished pictures + full-size viewer
js/upload.js          Upload picture screens (choose, crop, settings + preview)
js/convert.js         photo -> paint-by-numbers conversion (no DOM)
js/convert-worker.js  runs convert.js off the main thread
js/db.js              IndexedDB storage for uploaded pictures + progress
js/celebrate.js       confetti + finished-picture overlay
js/sound.js           small synthesized sound effects
js/ui.js              DOM helpers, icons, toast, confirm dialog
js/app.js             startup, page-gesture lock, screen switching
serve_https.py        local https server for iPad testing
check.html            artwork checker (tap sizes, palette rules)
```

The icons are PNGs because iOS requires them. If you change `icons/icon.svg`,
re-export `apple-touch-icon.png` (180×180), `icon-192.png` and
`icon-512.png` from it with any image tool.
