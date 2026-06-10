# `/grasp` Atlas Marker Hierarchy + Ambiance — Design

**Date:** 2026-06-10
**Branch:** `atlas-voyage`
**Status:** approved design, pre-implementation

## 1. Why this exists

At Continent/City altitude the globe cannot tell its two lower tiers apart.
Cities and landmarks both render through globe.gl `labelsData` — always a
filled circle plus text — differing only in numbers (`size 0.95/dot 0.42` vs
`size 0.6/dot 0.24`) and both painted in the same continent color
(`geo.color`). Four problems compound:

1. **Size is the only differentiator**, and label sizes are angular, so the
   camera scales both tiers together — "big vs small" never reads as
   "different kind of thing."
2. **Color is saturated out.** Within a continent, polygons, dots, text,
   arcs, and the sprite all share one tint; color carries zero tier
   information and contrast is poor (gold text on gold-tinted land).
3. **Same typography** for both tiers.
4. **Figure/ground never inverts.** At City altitude the huge city label
   competes with its own landmarks, and landmark labels collide.

Cartographic fix: tiers are *categorical*, so they need the categorical
visual channel — **shape** — plus typographic tiering, not more size deltas.
gpt-image-2 (ZenMux) supplies the shapes as a sprite family matching the six
existing low-poly continent dioramas.

## 2. Visual grammar — three silhouette signatures

Each tier owns a *form*, not a size:

| Tier | Form signature | On-screen size | Label |
|---|---|---|---|
| Continent | floating-island diorama (exists) | 34–160 px | title under sprite (exists) |
| City | compact low-poly building emblem **on a circular disc base**, no island | 28–64 px | CAPS, letterspaced, continent color |
| Landmark | **single bare low-poly object**, no base | 18–36 px | sentence case, off-white `#e8e6e0`, smaller |

The floating island is exclusive to continents; the disc base is the city
signature; landmarks are bare objects. "Scene vs badge vs object" separates
tiers pre-attentively, before any label is read.

Per-domain pairs (full set, user-approved):

| Domain | City emblem | Landmark object |
|---|---|---|
| architecture (Asia) | pagoda gate | glazed brick |
| modules (Europe) | clocktower | brass cog |
| workflows (N. America) | skyline cluster | torch |
| businessFlows (Africa) | mud-brick citadel | stone tablet |
| techSelection (S. America) | terraced hillside town | ashlar block |
| uiUxTaste (Oceania) | sail pavilion | nautilus shell |

All twelve in the established style: low-poly isometric, warm rim light in
the continent tint. Landmark prompts must demand *single object, bold
silhouette, minimal facets* — readable at 28 px.

## 3. Assets & generation pipeline

- **Generator:** ZenMux `openai/gpt-image-2` via the OpenAI-compatible
  images route (the zenmux skill CLI is text-only; use the small POST +
  `b64_json` helper). Key loaded per-command from `~/.zshrc`.
- **Masters:** 1024², `quality: high`, flat uniform background (dark slate
  for pale subjects). Keyed with ImageMagick 4-corner floodfill
  (`-fuzz 14%`), as for the continent sprites.
- **Shipped:** 512² transparent PNGs at
  `packages/dashboard/public/atlas/cities/{domain}.png` and
  `packages/dashboard/public/atlas/pins/{domain}.png`. Masters/raws stay in
  the gitignored `packages/dashboard/atlas-sprite-src/`.
- **Ambiance assets:**
  - `public/atlas/ocean.jpg` — equirectangular "night atlas" ocean: deep
    ink-blue, faint rhumb lines and stars, **no landmasses**. Generated at
    1536×1024, resized to 2048×1024 (stretching is fine — no geography).
    The tinted Natural Earth polygons remain the land, so coastlines stay
    accurate; a generated Earth texture could never align with the GeoJSON.
  - `public/atlas/compass.png` — compass rose, keyed; corner ornament and
    loading state.
- **Budget:** ~14 generations ≈ 100k image-tokens plus silhouette retries.
- **Approval gate:** contact sheet of all keyed sprites reviewed by the user
  before any wiring (Phase A acceptance).

## 4. Adapter seam (pure-data, skin stays renderer-side)

`buildAtlasView` stays story-agnostic. The only adapter change: add
`domain: AtlasDomain` to `CityView` and `LandmarkView` (cities/landmarks
already know their continent; the renderer maps domain → sprite URL exactly
as `CONTINENT_GEO` maps domain → motif). No sprite paths, no label casing,
no pixel sizes in the adapter — all of that is renderer skin.

## 5. Rendering — one billboard system, three tiers

`labelsData` is **retired** for cities and landmarks (globe.gl labels keep
nothing; arcs/polygons unchanged). The existing continent rAF overlay in
`globeImpl.tsx` generalizes to a single billboard system:

- **Billboard model (renderer-side):** `{ id, tier: "continent"|"city"|"landmark",
  lat, lng, spriteUrl, label, color, staggerIndex }` built once per `view`
  from the three view arrays.
- **Per-frame (rAF, ref-driven, no React state):** for every billboard —
  screen position via `getScreenCoords`; far-side occlusion via the existing
  dot-product test; **LOD visibility** from live `selectionContext` using
  the same `visibleAt` + focus-filter rules the labels use today (cities
  appear at Continent altitude, filtered to the focused continent; landmarks
  at City altitude, filtered to the focused city); dim non-focused
  continents as today.
- **Size curves:** one camera-distance scale (`REF_DIST / camDist`), three
  clamps — continent `[34, 160]`, city `[28, 64]`, landmark `[18, 36]`.
- **Typography:** city label `text-transform: uppercase; letter-spacing:
  0.08em`, continent color, dark text-shadow; landmark label sentence case,
  `#e8e6e0`, ~10 px, dark text-shadow. Label text composed renderer-side
  (`name · anchorName` for cities, unchanged order).
- **Staging (figure/ground inversion):** at level 4 (Landmark altitude) the
  focused city's billboard scales to ~60 % and opacity ~0.45 — it becomes
  context. Selected billboard gets a z-index bump.
- **Collision:** landmark labels get a deterministic vertical stagger —
  `staggerIndex` = the landmark's index within its city, stepped to different
  depths below the sprite (`(i mod 3) · 14 px`; below-only so a label never
  rides up onto its own pin — adjusted during the Task 10 screenshot pass).
  No physics, fully deterministic, testable.
- **Interaction:** billboards stay `<button>`s → `onSelect(id)`; `title`
  attr for hover. Arc/polygon/globe click handlers unchanged.
- **Failure tier (warning, non-fatal):** sprite `onerror` swaps the `<img>`
  for a CSS dot in the tier's color and logs one `console.warn` per URL.
  Missing ocean texture falls back to `earth-dark.jpg` (kept in `public/`).
  The globe must never show a broken-image glyph.

## 6. Ambiance wiring

- `globeImageUrl` → `./atlas/ocean.jpg` (fallback above).
- Land polygons: focused alpha `0.42 → 0.55` so land reads as land over the
  darker ocean; dimmed alpha stays `0.08`.
- Atmosphere re-tuned to the ocean's ink-blue (start `#4a7fd6`, tune by eye).
- Compass rose: absolutely positioned bottom-left of the stage, ~72 px,
  `opacity 0.5`; shown at full opacity as the loading state while the world
  GeoJSON fetch is in flight.
- The globe stage remains dark in both app themes (unchanged behavior).

## 7. Non-goals

- Per-landmark unique icons. Briefs are produced per-repo at analysis time;
  sprites are static plugin assets. The vocabulary is fixed per domain —
  which is also how real maps work (shared POI symbols, unique labels only).
- Light-theme parchment ocean variant (possible later; one texture now).
- Decorative ships / sea monsters.
- `AtlasOutline` (2D fallback) changes — it already distinguishes tiers
  structurally.

## 8. Testing (deterministic, no rAF flakiness)

Component tests run against the mocked globe (existing pattern) and assert
on the static DOM the billboard system renders; the rAF loop only mutates
style, so structure is testable synchronously:

1. Adapter: `CityView`/`LandmarkView` carry the correct `domain`.
2. Billboard structure: every city/landmark in view renders a `<button>`
   with the right sprite `src` (`cities/{domain}.png` / `pins/{domain}.png`)
   and accessible name.
3. Typography classes: city labels carry the CAPS class, landmark labels the
   quiet class (assert class names, not computed style).
4. Stagger determinism: landmark N within a city gets the expected offset
   class/inline custom property.
5. Fallback: firing `error` on a sprite `<img>` swaps in the CSS-dot
   fallback node.
6. globe.gl props: `labelsData` no longer receives city/landmark entries.
7. globe.gl props: `globeImageUrl` points at the ocean texture.
8. Existing 44 test files stay green.

## 9. Phasing (each independently green)

- **Phase A — Assets.** Generate 12 sprites + ocean + compass; key and
  downscale; produce a contact sheet. *Gate: user approves the sheet.*
  No code changes; assets land in `public/atlas/`.
- **Phase B — Billboard system.** Generalize the overlay to three tiers,
  retire city/landmark labels, typography tiers, staging + stagger,
  failure fallbacks, tests 1–6 & 8.
- **Phase C — Ambiance.** Ocean texture + polygon alpha + atmosphere +
  compass, test 7, screenshot pass at all four altitudes for the README.
