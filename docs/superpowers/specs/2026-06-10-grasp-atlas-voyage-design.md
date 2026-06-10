# `/grasp` Atlas Voyage — story, fidelity, depth — Design

**Date:** 2026-06-10
**Status:** Approved (user mandate: "Make this repo better. No constrain."), implemented same day
**Builds on:** Atlas globe design (`2026-06-09-grasp-atlas-globe-design.md`), Phases 1–2 merged at `dcc9300`.

---

## 1. Why this exists

Phases 1–2 shipped a working globe, but the user's review found it "too coarse
to say finished." Three gaps:

1. **UI fidelity** — the rendered dashboard barely resembles the approved mockup
   (`ui_design.jpg`): the globe is black-on-black (no tinted continents), the
   altitude rail is plain text, the detail panel lacks RELATED FLOWS and styled
   evidence rows, the bottom band lacks Search and the mini detail card, the
   ORBIT badge is missing.
2. **Analysis depth** — a real run produced `1 cities · 1 landmarks` per
   continent. Root cause: `agents/essence-analyzer.md` anchors the LLM with a
   one-city/one-landmark example and sets **no density floor**; the warning tier
   never flags thin continents.
3. **No story** — the product goal is an *experience*: "tell an attractive story
   about the target project, like an exciting trip" (reference: Disney's
   *Soaring Over the Horizon*). The landmark motifs are decoration today; they
   should carry **concepts** that teach each domain.

## 2. The storytelling layer (user-specified concepts)

Each domain's landmark is a *teaching metaphor*. Fixed table, renderer-side
(extends the existing `CONTINENT_GEO` principle: geography — and now narrative —
is a skin; the analyzer stays geography/story-agnostic):

| Domain | Landmark | Concept (epigraph) | Lesson |
|---|---|---|---|
| architecture | Great Wall | "Even the Great Wall starts with one brick." | A system is laid brick by brick — see the layers before the bricks. |
| modules | Eiffel Tower | "18,038 prefabricated pieces, assembled on site — modular is the power." | Independent parts with clean joints: swappable, repairable, replicable (the tower's platforms, elevators, and repaint zones are all module seams). |
| workflows | Statue of Liberty | "French design, American made — standard flows make things happen." | A standardized handoff lets work cross any boundary: design in one place, assemble in another. |
| businessFlows | Pyramids | "The oldest org chart in stone — business flow comes first." | Hierarchy and flow of value were designed before a single block moved. |
| techSelection | Machu Picchu | "Ashlar and andenes — the best choice is the one that fits." | Technique chosen to fit the mountain, not the fashion: selection is fit, not fame. |
| uiUxTaste | Opera House | "Beauty as productivity." | A distinctive sensibility is a feature: taste compounds into adoption. |

**Where the story surfaces**
- `DOMAIN_STORY` table in `packages/dashboard/src/adapters/atlas.ts`
  (`concept`, `lesson` per domain), exported beside `CONTINENT_GEO`.
- **Continent detail panel**: a story card (motif art + concept epigraph +
  lesson) above the repo's actual summary.
- **AtlasIntro rail**: concept line per domain row.
- **HowItWorks**: each continent becomes a *chapter* — `Chapter N — Title
  (Motif)` with the concept as an epigraph.
- **Export** (`atlasToMarkdown` / `atlasToHtml`): the concept line as an
  italic epigraph under each continent heading (static strings from the fixed
  table — no new untrusted input).

**Voyage mode (the "Soaring Over the Horizon" trip)**
- `buildVoyage(view): VoyageStop[]` — a **pure, deterministic** adapter
  function. Stops: orbit intro → for each populated continent (fixed domain
  order): the continent (story card) → its richest city → that city's first
  landmark with `whyItMatters` (spotlight) → … → orbit outro.
- UI: a **▶ Voyage** button on the globe; an overlay card per stop (chapter
  number, motif, concept, then the repo's real summary/why); controls
  prev/pause/next/exit; auto-advance ~7s; driving `selectedId` so the existing
  camera/LOD machinery does the flying. Esc or background exits.
- Tests target `buildVoyage` (ordering, skipping empty continents, spotlight
  pick) and the overlay's render/controls with the globe mocked.

## 3. UI fidelity to `ui_design.jpg`

1. **Tinted continent polygons** — bundle a slimmed Natural Earth 110m
   countries GeoJSON (public domain) at
   `packages/dashboard/public/atlas/world.geojson`, properties reduced to
   `{ continent }`. `globeImpl` loads it and renders a polygons layer tinted by
   continent → domain color (Antarctica = gray "Uncharted"). Non-focused
   continents desaturate when diving. A `scripts/fetch-world-geojson.mjs`
   documents/reproduces the asset (checked in; script not run at build time).
2. **ORBIT badge** — top-left over the globe; text follows the level
   (`ORBIT · Whole product view · Six dimensions` → `CONTINENT · {title}` …).
3. **Altitude rail** — icon stepper with connecting arrows, active glow.
4. **Detail panel** — RELATED FLOWS section (arcs touching the selected
   city/landmark, `source → target` + type chip; `ArcView` gains
   `sourceId/targetId/sourceName/targetName`); evidence rows styled as
   claim + source chip; continent panel lists its cities (clickable), city
   panel lists its landmarks (clickable).
5. **Bottom band** — Camera-altitudes rows expand to show cities (+ "Open
   all"); List-view panel gets `Outline | Search` tabs (search filters by
   name/tech/tag, case-insensitive) and a mini detail card mirroring the
   selection.
6. **Theme pass** — deep-navy cards, gradients, chips per the mockup; footer
   guarantees get icons.

Security unchanged: all repo-derived strings continue through React text
rendering / `esc()` / `mdText()`; the new story strings are static constants.

## 4. Analyzer depth (Phase 3 of the globe spec)

1. **Rewrite `agents/essence-analyzer.md`** with an explicit **density
   contract** per depth:
   - `docs`: all six continents attempted, summary each, ≥1 city where the
     docs support it.
   - `skim` (default): all six continents, **2–4 cities each, 1–3 landmarks
     per city**, ≥3 flows in each of `workflows`/`businessFlows`,
     `whyItMatters` on **every** landmark, evidence with `file:line` sources.
   - `deep`: up to the 120-landmark cap, flows may span more chains.
   - Per-domain guidance for what a city/landmark *is* (architecture: layers;
     modules: packages/components; workflows: runtime stages; businessFlows:
     user/value journeys; techSelection: choice + rejected alternative + why;
     uiUxTaste: concrete observable details).
   - A storytelling register for `summary` fields (the text feeds chapters).
   - A **rich example** (2 cities × 2 landmarks, flows) so the LLM anchors high.
2. **Warning tier additions** (`computeWarnings`): a populated continent with
   **one city** ("thin"); a landmark **missing `whyItMatters`**; a
   `workflows`/`businessFlows` continent with cities but **zero flows**; a
   landmark with **no evidence**. Golden sample stays warning-free (so it gets
   enriched to the new bar — see 3 below).
3. **Rich golden sample** — `sample-brief.json` becomes a full self-teardown
   of grasp itself: six continents, 2–3 cities each, 2+ landmarks per city,
   flows on both flow continents, `whyItMatters` + evidence everywhere. It is
   the dashboard demo (`sync-sample`), the test fixture, and the analyzer's
   north star.
4. **SKILL.md Phase 3** — when assemble prints warnings naming thin
   continents, re-dispatch the essence-analyzer once for those continents with
   the warning text appended.

## 5. Testing

- `buildVoyage`: deterministic order, skips empty continents, spotlight =
  first landmark with `whyItMatters` in the richest city, outro present.
- `ArcView` endpoint ids/names; related-flows lookup for a selection.
- Warnings: each new advisory fires on a minimal bad doc; golden sample clean.
- Search filter: pure predicate tested (name/tech/tag, case-insensitive).
- Export: epigraph lines appear, still escaped, Mermaid untouched.
- Globe remains mocked in jsdom; polygons layer behind the same mock.

## 6. Phasing (each independently green)

1. Schema warnings + rich golden sample (they must land together).
2. Story layer (DOMAIN_STORY, panels, chapters, export epigraphs).
3. Voyage mode (pure builder + overlay + controls).
4. Globe visuals (world polygons, badge, related flows, rail, theme pass).
5. Bottom band (expandable table, search, mini card).
6. Analyzer prompt rewrite + SKILL.md warning loop.
