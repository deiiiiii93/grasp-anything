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

**Positioning:** the Atlas is a **product-teardown map — from product-level
understanding down to implementation-level evidence.** The globe is playful, but
the contract stays serious: a deterministic hierarchy of product reasoning,
evidence, and exportable explanation. (Geography is a skin; the data is the point.)

### Decisions locked during brainstorming
- The graph is a **true 3D globe** (WebGL via `react-globe.gl`/three.js), **not**
  2D. The user explicitly accepted the consequences ("nothing is indispensable").
- **All six** domains are continents (Technical Selection and UI/UX Taste
  included), and they double as the textual "How it works" dimensions.
- Use **real continents and real landmark motifs** for playfulness.
- Four altitudes: **Orbit → Continent → City → Landmark**.
- Build is **phased** — now **three** phases (places → flows → analyzer quality, §10).
- A single pure adapter **`buildAtlasView(doc): AtlasView`** is the spine; WebGL is
  isolated behind it (§5).
- `Landmark` carries **`whyItMatters`** + **`tags`**; `validateBrief` gains a
  **warning tier** beside hard errors (§4).
- Dashboard is a **three-zone layout** with top nav *Strategic | Atlas | Landscape
  | Evidence* (§5).

*(This spec was revised on 2026-06-09 from the user's implementation-ready review —
those refinements are folded into §4, §5, §7, §9, §10.)*

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
  detail?: string;       // WHAT it is — one-to-three sentences
  whyItMatters?: string; // WHY this choice matters (the PM takeaway)
  techTag?: string;      // e.g. "LangGraph", "FastAPI"
  tags?: string[];       // free labels, e.g. ["determinism", "HITL"]
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
  evidenceIds?: string[];
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

**Hard errors (`validateBrief` superRefine — fail the brief), additive to today's rules:**
- `atlas.continents` is present.
- Every `evidenceIds` entry (continent/city/landmark/flow) resolves to an `evidence[]` id.
- `domain` is unique across `continents`.
- All ids (continent/city/landmark) are globally unique within the brief.
- Each `Flow.source`/`target` resolves to a city **or** landmark id **inside the
  same continent**.
- `title`/`name`/`summary` are non-empty after trimming where present.
- Phase 1 allows empty `flows`; **sparse continents are valid** (a continent may
  have zero cities).

**Warnings (do not fail — surfaced to the orchestrator/user):** `validateBrief`'s
return type gains `warnings: string[]` alongside `errors`/`data`. Warning checks:
- a continent has a `summary` but **no evidence**;
- a landmark has **no `detail`**;
- a city has **zero landmarks**;
- the atlas has **fewer than three populated continents** (thin teardown);
- landmark count exceeds a **performance cap** (globe gets crowded).

These let a brief render while telling the orchestrator where the analysis is thin
(it can re-dispatch the analyzer for those continents).

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

**The spine — one pure adapter (`adapters/atlas.ts`):**

```ts
buildAtlasView(doc: BriefDoc): AtlasView
interface AtlasView {
  continents: AtlasContinentView[]; // domain, title, summary, tint, lat/lng, motif
  cities: AtlasCityView[];          // deterministic lat/lng within continent polygon
  landmarks: AtlasLandmarkView[];   // deterministic lat/lng; detail/why/tech/tags/evidence
  arcs: AtlasArcView[];             // great-circle endpoints for flows (Phase 2)
  outline: AtlasOutlineNode[];      // the nested text tree (export + a11y + How-it-works)
}
```

`buildAtlasView` is **pure and deterministic** (same `doc` → identical lat/lng and
outline). It performs the **domain → geography** mapping (§3 table) and the seeded
in-polygon placement, so **WebGL is fully isolated from business logic** — every
component and the export consume `AtlasView`, never the globe library. This is the
single most important testable seam.

**Components**
- `adapters/atlas.ts` — `buildAtlasView` (above). No React, no three.js.
- `components/AtlasGlobe.tsx` — the `react-globe.gl` wrapper; consumes `AtlasView`;
  owns camera/LOD/breadcrumb. The only file that imports the globe library.
- `components/AtlasOutline.tsx` — the accessible nested list from `outline` (buttons
  → detail panel); also the WebGL-absent fallback and the "List view".
- `components/HowItWorks.tsx` — the **text** teardown from `outline`: each
  continent's `title` + `summary` + cities/landmarks as bullets, with evidence chips.
- `components/AtlasDetail.tsx` — the right-hand detail panel: `name`, `detail`,
  **`whyItMatters`**, `techTag`, `tags`, related flows, evidence chips.
- `ConceptGraph.tsx` is **removed**; `LandscapeGraph` + `ForceGraph` stay.

**Dashboard layout — three zones + top nav:**

```
┌──────────────────────────────────────────────────────────────┐
│ Top nav:  Strategic │ Atlas │ Landscape │ Evidence            │
├───────────────┬───────────────────────────────┬──────────────┤
│ Atlas intro   │ 3D globe                       │ Detail panel │
│ six domains   │ altitude rail                  │ why/tech/tags│
│ legend        │ camera / LOD controls          │ evidence/flow│
├───────────────┴───────────────────────────────┴──────────────┤
│ Bottom: How-it-works text  +  accessible outline / list view  │
└──────────────────────────────────────────────────────────────┘
```

Left rail explains the six continents (legend); center is the globe (altitude rail
+ LOD controls); right is the selected-landmark detail; the bottom band carries the
deterministic outline/list view. The **Evidence** tab aggregates all evidence chips.

**New deps:** `react-globe.gl`, `three`, `@types/three`, and a world GeoJSON asset
(small, public-domain, e.g. world-atlas 110m), bundled for the self-contained dist.
The globe module is **lazy-loaded** so the Strategic/Landscape/Evidence tabs don't
pay for WebGL.

### 5.1 Canonical UI (mockup)

The build targets the approved mockup **`docs/superpowers/specs/2026-06-09-grasp-atlas-ui.png`**.
Element inventory the implementation must match:

- **Top nav:** `Strategic · Atlas · Landscape · Evidence`; right side = breadcrumb
  (`Atlas › Asia › Orchestration › SQLite checkpointer`) + **"List View"** toggle.
- **Left rail (Atlas intro):** `/grasp` wordmark → "Product Atlas" → tagline
  *"How it works — explore from Orbit to Landmark"* → one-paragraph blurb →
  **"SIX DOMAINS · SIX CONTINENTS"** list; each row = colored dot · *Domain →
  Continent* · the domain's **guiding question** · the **landmark motif** name.
  Footer row: *"Antarctica (optional) — Uncharted / low confidence (Phase 2+)"*.
- **Center (globe):** tinted continents + landmark sprites; an **ORBIT** badge
  (*"Whole product · Six dimensions"*) top-left; a bottom **altitude rail** = a
  4-step stepper — **① Orbit** (Whole product) · **② Continent** (Explore one) ·
  **③ City** (Landmarks & flows) · **④ Landmark** (Details & evidence).
- **Right (detail panel), adapts per altitude:** kind tag (`LANDMARK`) → name +
  `techTag` → **WHY IT MATTERS** (`whyItMatters`) → **EVIDENCE** (each: claim /
  source with file ref + external-link icon, link via `safeHref`) → **RELATED
  FLOWS** chips (`source → target`, flow `type`). At Continent/City the panel
  shows the `summary` + that level's evidence.
- **Bottom band — two columns:**
  - Left **"CAMERA ALTITUDES (WHAT YOU SEE)"**: a six-row table — dot · *Domain
    (Continent)* · guiding question · `N cities · M landmarks` · expand; **"Open
    all"**. Footnote: *"the atlas is also available as an outline in the export
    (Markdown/HTML) with Mermaid flow diagrams."*
  - Right **"LIST VIEW (OUTLINE)"**: tabs `Outline · Search`; the accessible
    nested tree (continent → city → landmark) with the selected node highlighted;
    a mini detail card mirroring the right panel.
- **Footer guarantees row:** *Accessible · Export ready · Secure by default ·
  Deterministic layout · Fallback*, each with a one-line caption; **Phase 1/2/3**
  badges at the right.

The mockup is the source of truth for layout/copy; this spec is the source of
truth for data/behavior. Where they differ, raise it rather than guessing.

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
with three **atlas renderers**, all fed by `buildAtlasView(doc).outline` (imported
from `@grasp/dashboard/adapters`) so the export and the dashboard list view never
drift:

- **`atlasToMarkdown.ts`** → `report.md`: a nested outline — `## How it works` →
  per continent `### {title}` + summary → cities as `####` → landmarks as bullets
  (`- **name** (techTag) — detail [^evid]`), with `whyItMatters` as a sub-line.
- **`atlasToHtml.ts`** → `report.html`: the same outline as semantic HTML sections.
- **`atlasToMermaid.ts`** → a ```mermaid``` flow diagram per flow continent
  (Workflows / Business Flows) — Phase 2; escaped labels + slugged node ids.
- No WebGL assumptions anywhere in export. Landscape export
  (`landscapeToSvg`/`landscapeToMermaid`) is **unchanged**.

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

- **Schema** (`@grasp/schema`): valid atlas passes; duplicate domains fail;
  duplicate ids fail; unresolved evidence fails; cross-continent flow endpoint
  fails; **sparse continent passes**; warning checks fire without failing. Golden
  `sample-brief.json` updated to the atlas shape and round-trips.
- **Adapter** (`@grasp/dashboard`): `buildAtlasView` is **deterministic** (same
  doc → identical lat/lng); each point lands **inside its assigned continent
  polygon or the deterministic fallback ring**; `outline` matches the hierarchy;
  a landmark maps to the detail-panel model (`detail`/`whyItMatters`/`tags`).
- **Globe component:** `react-globe.gl` **mocked** (no WebGL in jsdom) — renders
  the **fallback when WebGL is unavailable**; click continent updates breadcrumb;
  click city reveals landmarks; click landmark opens the detail panel; "List view"
  toggle works. `AtlasOutline` tested fully (buttons, keyboard navigation).
- **Export** (`@grasp/export`): `atlasToMarkdown`/`atlasToHtml` outline structure;
  `atlasToMermaid` structure; hostile-text + Mermaid escaping; **no WebGL
  assumptions** anywhere in export.

---

## 10. Phasing

**Phase 1 — places, text, fallback (all six continents, no flows)**
- `@grasp/schema`: the `atlas` model + validation (errors **and** warnings); golden sample.
- Analyzer (`essence-analyzer`) + `assemble`: emit/merge `atlas` (replacing `conceptGraph`).
- `adapters/atlas.ts` `buildAtlasView` (the pure spine) → `AtlasView` incl. `outline`.
- `AtlasGlobe` (`react-globe.gl`) with real continents, city/landmark points,
  camera-altitude LOD (Orbit→Continent→City→Landmark), detail panel, breadcrumb,
  WebGL-absent fallback.
- `AtlasOutline` list view (a11y) + `HowItWorks` text section + three-zone layout.
- `@grasp/export`: `atlasToMarkdown` / `atlasToHtml` (outline only, no flows yet).
- Landscape + strategic cards untouched.

**Phase 2 — flows, art, polish**
- Great-circle **flow arcs** for Workflows/Business Flows + cross-continent arcs.
- Curated landmark **sprites/art**, idle auto-rotate, smoother camera easing.
- **`atlasToMermaid`** flow diagrams in the export; optional Antarctica "uncharted".
- Performance pass (point/arc counts, GeoJSON size).

**Phase 3 — analyzer quality**
- A dedicated **`atlas-analyzer`** agent **if** the `essence-analyzer` prompt gets
  too crowded (fragment contract unchanged).
- Per-finding **confidence scoring**; richer **technical-selection** reasoning
  (`whyItMatters` depth); concrete **UI/UX-taste** examples.
- **Evidence-density checks** wired to the warning tier (§4).

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
