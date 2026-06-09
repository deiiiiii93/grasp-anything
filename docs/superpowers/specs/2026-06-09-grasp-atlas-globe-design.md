# `/grasp` Atlas — a 3D globe teardown of "How it works" — Design

**Date:** 2026-06-09
**Status:** Approved (brainstorming), pending implementation plan
**Builds on:** `/grasp` v1 (`2026-06-08-grasp-design.md`), export (`2026-06-08-grasp-export-design.md`), and the interactive force graphs (dashboard `ForceGraph`, merged `6dfd320`).

---

## 1. Summary

Replace grasp's abstract **concept graph** with a **Product Atlas**: a true **3D
globe** (WebGL) that a reader explores like a terrestrial globe — *from far to
near*. The product's "how it works" is laid out as **six continents**, each a
domain of understanding a product manager uses to reverse-engineer why and how
someone else's product succeeds:

**Architecture · Modules · Workflows · Business Flows · Technical Selection · UI/UX Taste.**

The reader flies through four altitudes — **Orbit → Continent → City → Landmark** —
and detail *emerges* as they descend. The same six domains are also narrated in
text in the **"How it works"** section, so the brief explains by **text** and by
**graph** in parallel.

This **replaces** `conceptGraph`. The **landscape graph keeps** the 2D
`ForceGraph` renderer built previously. The strategic prose cards (idea / problem
/ why / takeaway) are unchanged.

### Decisions locked during brainstorming
- The graph is a **true 3D globe** (WebGL via `react-globe.gl`/three.js), **not**
  2D. The user explicitly accepted the consequences ("nothing is indispensable").
- **All six** domains are continents (Technical Selection and UI/UX Taste
  included), and they double as the textual "How it works" dimensions.
- Use **real continents and real landmark motifs** for playfulness.
- Four altitudes: **Orbit → Continent → City → Landmark**.
- Build is **phased** (see §10).

### Consequences we accept (direct results of choosing 3D)
1. **No globe in the static export.** WebGL cannot serialize to SVG, so the
   export (`report.md` / `report.html` / PDF) renders the atlas as a **structured
   outline** (continent → city → landmark) **+ Mermaid** for flows — not the globe.
2. **Accessibility fallback.** The WebGL canvas is opaque to screen readers, so
   the dashboard ships a **parallel HTML outline ("list view")** beside the globe.
   *(The outline is one artifact doing three jobs: export, a11y, and the analyzer's
   structured data.)*
3. **Bundle grows** by a few hundred KB (three.js + globe.gl + a world GeoJSON).
4. **Tests target the deterministic data layer**, not WebGL pixels (see §9).

---

## 2. Goals / Non-goals

**Goals**
- Make "How it works" concrete and explorable: modules, workflows, technical
  choices (+ rationale), and UI/UX taste — as a navigable 3D map and as text.
- One structured source (`atlas`) feeds three views: the globe, the "How it
  works" text section, and the export outline.
- Preserve the `repo-brief.json`-is-the-only-contract architecture.

**Non-goals**
- Literal scale-accurate Earth cartography. We use **real continent polygons +
  real landmark motifs** as a playful skin, not a GIS-grade map.
- Interactive globe inside the PDF/Markdown export (impossible; outline instead).
- Changing the landscape graph, the strategic prose cards, or the incremental
  pipeline (`grasp-state`).

---

## 3. The persona and the six domains

The reader is a **product manager tearing down another author's product** to learn
*why* and *how* it succeeds. The six continents:

| Domain (`domain` enum) | Continent (real) | Landmark motif | What it answers |
|---|---|---|---|
| `architecture` | Asia | 🏯 Great Wall | How is the system structured (layers)? |
| `modules` | Europe | 🗼 Eiffel Tower | What are the building blocks + responsibilities? |
| `workflows` | North America | 🗽 Statue of Liberty | How does data/control flow at runtime? |
| `businessFlows` | Africa | 🛕 Pyramids | What journeys does the user/value take? |
| `techSelection` | South America | 🗿 Machu Picchu | What was chosen over what, and why? |
| `uiUxTaste` | Oceania | 🎭 Opera House | What is the design/interaction sensibility? |

*(Antarctica is reserved as "uncharted" — an optional home for low-confidence/
inferred items. Phase 2+, optional.)*

The **domain → continent + landmark** mapping is a **fixed table in the renderer**,
not in the schema. The analyzer emits a geography-agnostic hierarchy keyed by
`domain`; the renderer paints it onto Earth. This keeps the contract clean and
lets the geography change without reanalysis.

---

## 4. Data model (the contract)

`repo-brief.json` changes: **remove `conceptGraph`, add `atlas`.** `landscapeGraph`,
`meta`, `brief`, and `evidence` are unchanged (`brief.how` stays as a one-paragraph
overview; the detailed six-dimension teardown lives in `atlas` and is rendered as
the "How it works" section).

```ts
// new enums in @grasp/schema
export const atlasDomains = [
  "architecture", "modules", "workflows",
  "businessFlows", "techSelection", "uiUxTaste",
] as const;
export const flowEdgeTypes = [
  "calls", "streams", "persists", "fansOut", "reviews", "next",
] as const;

interface Landmark {
  id: string;            // unique within the brief
  name: string;          // e.g. "SQLite checkpointer"
  detail?: string;       // one-to-three sentences
  techTag?: string;      // e.g. "LangGraph", "FastAPI"
  evidenceIds: string[];
}
interface City {
  id: string;
  name: string;          // e.g. "Orchestration"
  summary?: string;
  evidenceIds: string[];
  landmarks: Landmark[];
}
interface Flow {         // only meaningful for flow continents
  id: string;
  source: string;        // a city OR landmark id within THIS continent
  target: string;
  type: (typeof flowEdgeTypes)[number];
  label?: string;
}
interface Continent {
  id: string;
  domain: (typeof atlasDomains)[number];  // unique across continents
  title: string;         // human label, e.g. "Architecture"
  summary: string;       // the TEXT teardown for this dimension (prose)
  evidenceIds: string[];
  cities: City[];
  flows: Flow[];         // default []
}
interface Atlas {
  continents: Continent[];   // 0..6; Phase 1 may emit a subset
}
```

**Validation (`validateBrief` superRefine), additive to today's rules:**
- Every `evidenceIds` entry (continent/city/landmark) resolves to an `evidence[]` id.
- `domain` is unique across `continents`.
- All ids (continent/city/landmark) are globally unique within the brief.
- Each `Flow.source`/`target` resolves to a city **or** landmark id **inside the
  same continent**.
- `name`/`title`/`summary` are non-empty where present.

**Why a hierarchy, not a flat graph:** the four altitudes are literally the three
nesting levels (continent → city → landmark) plus the orbit overview. The renderer
reads depth directly from the data.

---

## 5. The globe (dashboard)

**Tech:** `react-globe.gl` (globe.gl on three.js/WebGL). It provides a polygons
layer (continents), a points layer (cities/landmarks), an arcs layer (flows),
HTML markers (landmark motifs), and `pointOfView({lat, lng, altitude}, ms)` for
camera flights — which *is* the altitude ladder.

**Geo placement (deterministic, renderer-side):**
- A bundled **world GeoJSON** (continent/country polygons) provides each
  continent's landmass; the fixed table (§3) maps `domain → continent polygon +
  centroid lat/lng + landmark motif + tint`.
- **Cities** are placed at deterministic coordinates inside their continent's
  polygon (seeded distribution around the centroid; curated anchor cities optional
  in Phase 2). **Landmarks** cluster near their city. Placement is a pure,
  seeded function of ids so the layout is reproducible.

**Four altitudes (camera + level-of-detail):**
1. **Orbit** — full globe; six continents tinted by domain; continent labels +
   landmark motif sprites; slow idle auto-rotate (Phase 2). LOD: cities/landmarks
   hidden.
2. **Continent** — click a continent → `pointOfView` flies to its centroid at mid
   altitude; its **cities** fade in; other continents desaturate.
3. **City** — click a city → fly closer; its **landmarks** appear; **flow arcs**
   render for flow continents (Phase 2).
4. **Landmark** — click a landmark → the **detail panel** (reused pattern) shows
   `detail`, `techTag`, evidence chips; its arcs highlight.

**Navigation chrome:** a **breadcrumb** (`Atlas ▸ Asia ▸ Orchestration ▸
checkpointer`), an **"↩ Orbit"** reset, and a **"List view"** toggle (the outline,
§7). Background click ascends one altitude.

**Graceful fallback:** if WebGL is unavailable, render the **outline/list view**
instead of the globe (same data, §7).

**Components**
- `adapters/atlas.ts` — pure: `buildAtlasView(doc)` → `{ continents, cities,
  landmarks, arcs }` with deterministic lat/lng; plus `atlasOutline(doc)` (the
  nested text structure shared with export + a11y).
- `components/AtlasGlobe.tsx` — the `react-globe.gl` wrapper + camera/LOD/breadcrumb.
- `components/AtlasOutline.tsx` — the accessible nested list (buttons → detail panel).
- `components/HowItWorks.tsx` — the **text** teardown: each continent's `title` +
  `summary` + its cities/landmarks as bullets, with evidence chips.
- `ConceptGraph.tsx` is **removed**; the graph tab becomes **Atlas**. `LandscapeGraph`
  + `ForceGraph` stay.

**New deps:** `react-globe.gl`, `three`, `@types/three`, and a world GeoJSON asset
(small, public-domain, e.g. world-atlas 110m), bundled for the self-contained dist.

---

## 6. Analyzer + pipeline

- **Decision:** the **essence-analyzer emits the `atlas` hierarchy in place of
  `conceptGraph`** (it keeps producing idea / problem / `how`-overview). It reads
  README, docs, manifests, file tree, and — per `depth` — entry points/core files
  to populate continents → cities → landmarks, each with a `summary`, `techTag`,
  evidence, and (flow continents) `flows`. If the single prompt proves too large
  in practice, the plan may split a dedicated **atlas-analyzer** agent — but the
  fragment contract (`essence.json` carries `atlas`) stays the same either way.
- **Depth dependence:** `docs` yields sparse continents (summaries, few cities);
  `skim`/`deep` populate real cities/landmarks. The orchestrator (`SKILL.md`)
  states this; sparse atlases render fine (a continent can have 0 cities).
- **`assemble`** merges the `atlas` fragment (replacing the `conceptGraph` merge),
  runs `validateBrief`. `EssenceFragmentSchema` updated to carry `atlas`.
- Incremental pipeline (`grasp-state`, staleness) is **unchanged** in shape: the
  atlas is part of the essence stream.

**Data flow:** analyzer → `essence.json` (atlas) → `assemble` → `validateBrief` →
`repo-brief.json` → { dashboard globe + How-it-works text + outline; export
outline + Mermaid }.

---

## 7. Export (`@grasp/export`)

The globe is dashboard-only. The export replaces `conceptToSvg`/`conceptToMermaid`
with **atlas renderers**:

- **Markdown** (`report.md`): a nested outline —
  `## How it works` → per continent `### {title}` + summary → cities as `####` →
  landmarks as bullets (`- **name** (techTag) — detail [^evid]`) — **plus** a
  ```mermaid``` flow diagram per flow continent (Workflows/Business Flows).
- **Print HTML** (`report.html`): the same outline as semantic HTML sections;
  flows as inline static SVG or Mermaid-equivalent. No WebGL.
- The shared `atlasOutline(doc)` (from `@grasp/dashboard/adapters`) is the single
  source for the dashboard list view **and** the export, keeping them in sync.
- Landscape export (`landscapeToSvg`/`landscapeToMermaid`) is **unchanged**.

---

## 8. Security (untrusted repos)

The atlas is built by an LLM reading an **untrusted** repository, so
`name`/`title`/`summary`/`detail`/`techTag` and any url are hostile. Every surface
must escape per its grammar (the existing constraint):
- **Globe HTML markers / labels** → HTML-entity escape; any url via `safeHref`.
- **Outline / How-it-works (HTML)** → `esc()`; urls via `safeHref`.
- **Markdown outline** → escape link-breaking chars (reuse the export's markdown
  escaping); **Mermaid** flow labels → entity-escape `& < > "` and slug node ids
  (reuse `mermaid.ts` helpers).
The shared `safeHref` (`@grasp/export/src/url.ts`) remains the URL guard.

---

## 9. Testing strategy

- **Schema** (`@grasp/schema`): atlas validation — evidence resolution, unique
  domains/ids, flow endpoints resolve within-continent; golden `sample-brief.json`
  updated to the atlas shape and round-trips.
- **Adapter** (`@grasp/dashboard`): `buildAtlasView` is **deterministic** (same
  doc → identical lat/lng), points fall within their continent polygon,
  `atlasOutline` reflects the hierarchy.
- **Globe component:** smoke tests with `react-globe.gl` **mocked** (WebGL is
  absent in jsdom) — renders, a click invokes the select handler, breadcrumb
  updates. `AtlasOutline` tested fully (buttons, keyboard, detail panel).
- **Export** (`@grasp/export`): atlas → Markdown outline + Mermaid structure tests;
  escaping/XSS tests for hostile names/urls.
- **A11y:** the outline renders landmarks as focusable buttons with labels.

---

## 10. Phasing

**Phase 1 — the navigable globe of places (all six continents, no flows)**
- `@grasp/schema`: the `atlas` model + validation; golden sample.
- Analyzer + `assemble`: emit/merge `atlas` (replacing `conceptGraph`).
- `react-globe.gl` `AtlasGlobe` with real continents, city/landmark points,
  camera-altitude LOD (Orbit→Continent→City→Landmark), detail panel, breadcrumb,
  WebGL-absent fallback.
- `atlasOutline` + `AtlasOutline` list view (a11y) + `HowItWorks` text section.
- `@grasp/export`: atlas **outline** in `report.md`/`report.html` (no flows yet).
- Landscape + strategic cards untouched.

**Phase 2 — flows, art, polish**
- Great-circle **flow arcs** for Workflows/Business Flows + cross-continent arcs.
- Curated landmark **sprites/art**, idle auto-rotate, smoother camera easing.
- **Mermaid flow** diagrams in the export; optional Antarctica "uncharted".
- Performance pass (point/arc counts, GeoJSON size).

Each phase is independently shippable and merges to `main` on its own (per the
project's per-plan cadence).

---

## 11. Risks / open questions

- **WebGL performance/bundle** — mitigate with a small GeoJSON and capped
  point/arc counts; lazy-load the globe module so non-graph users don't pay for it.
- **Deterministic in-polygon placement** — needs a stable point-in-polygon /
  centroid-jitter function; fall back to centroid ring if a polygon is complex.
- **Sparse repos** — a CLI tool may only fill 2–3 continents; the orbit must read
  well with empty/!-populated continents (show continent + summary only).
- **Analyzer load** — producing a 3-level, six-domain hierarchy is a large ask;
  `depth` gates richness and `SKILL.md` sets expectations.
- **GeoJSON licensing** — use a public-domain source (world-atlas / Natural Earth).
