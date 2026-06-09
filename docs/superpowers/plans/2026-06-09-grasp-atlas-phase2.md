# grasp Atlas — Phase 2 (flows, camera, art, export, perf) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Product Atlas globe *navigable* — fly Orbit→Continent→City→Landmark, draw intra-continent flow arcs, finish the landmark art, add Mermaid flow diagrams to the export, and lazy-load the globe to shrink the main bundle.

**Architecture:** Everything still flows through the single pure spine `buildAtlasView(doc): AtlasView`. Phase 2 *populates* `arcs` (currently `[]`) and adds a small pure level-of-detail helper; all WebGL behavior (camera flights, LOD visibility, arc layer) stays isolated in `globeImpl.tsx`/`AtlasGlobe.tsx`. The export gains one new pure renderer. No schema change.

**Tech Stack:** TypeScript (no build; `tsx`/Vitest, `moduleResolution: Bundler`), React, `react-globe.gl` (globe.gl/three), `@grasp/schema` (Zod), `@grasp/export`, Vitest + jsdom.

---

## DECISION TAKEN (flip at review if you disagree)

**Flow-arc scope = intra-continent only.** The Phase 1 schema (`validateBrief` superRefine) already requires every `Flow.source`/`target` to resolve to a city/landmark id **inside the same continent**. Phase 2 draws arcs for exactly those flows — **no schema/validation/analyzer change**. The spec's stray "+ cross-continent arcs" line (§10) is **not** implemented; doing so would reopen the approved Phase 1 contract. If you want cross-continent flows, say so and this plan grows a schema task (relax the endpoint check, update `validate.test.ts`, `essence-analyzer.md`, and arc rendering) — otherwise it stays out.

**Already done this session (not re-done here):** the 6 landmark sprite *materials* (`packages/dashboard/public/atlas/landmarks/{domain}.png`) and their **continent-level** DOM-overlay billboards in `globeImpl.tsx`. Phase 2's "art" item is therefore reduced to: (a) optionally show sprites at **city/landmark** altitude too, and (b) a sprite-size **perf** pass. The heavy art generation is complete.

---

## File Structure

**Modify**
- `packages/dashboard/src/adapters/atlas.ts` — populate `arcs` from `continent.flows`; extend `ArcView`; add pure `visibleAt()` LOD helper + `selectionContext()` (resolve a selectedId → {continent, city, landmark, level}). *(pure, no React/three)*
- `packages/dashboard/src/components/globeImpl.tsx` — react to `selectedId`: `pointOfView` camera flights; LOD show/hide of city/landmark dots + sprites; `arcsData` flow layer; background click ascends.
- `packages/dashboard/src/components/AtlasGlobe.tsx` — thread `selectedId` + `onAscend` to `GlobeImpl`; make it a **default export** for lazy-loading.
- `packages/dashboard/src/components/AtlasDetail.tsx` — render per-altitude: continent (`summary`+evidence), city (`summary`+evidence), landmark (full, unchanged).
- `packages/dashboard/src/components/AltitudeRail.tsx` — make steps **clickable** to ascend (descend is data-driven, not clickable).
- `packages/dashboard/src/App.tsx` — lazy-load `AtlasGlobe` in `<Suspense>`; pass the resolved selection node to `AtlasDetail`; wire ascend.
- `packages/export/src/mermaid.ts` — add `atlasToMermaid(doc)` (reuses the file-private `label`/`nodeId`).
- `packages/export/src/markdown.ts` — append atlas flow Mermaid blocks after `atlasToMarkdown`.
- `packages/export/src/atlasToHtml.ts` — append a semantic `<ol class="flows">` per flow continent.

**Create**
- `packages/dashboard/src/adapters/atlas-arcs.test.ts` — arc-building + `visibleAt` + `selectionContext` tests.
- `packages/export/src/atlasToMermaid.test.ts` — flow-diagram structure + escaping tests.
- `packages/dashboard/src/components/AtlasDetail.test.tsx` — per-altitude rendering (if not already covered in `components.test.tsx`; otherwise add cases there).

**No new runtime deps.** (Sprite quantization in Task 7 uses ImageMagick, already installed — a build-time asset step, not an npm dep.)

---

## Task 1: Build flow arcs in the pure adapter

**Files:**
- Modify: `packages/dashboard/src/adapters/atlas.ts`
- Test: `packages/dashboard/src/adapters/atlas-arcs.test.ts`

- [ ] **Step 1: Extend `ArcView` and add a flow-type import**

In `atlas.ts`, replace the `ArcView` interface:

```ts
import type { BriefDoc, AtlasDomain, FlowEdgeType } from "@grasp/schema";
// ...
export interface ArcView {
  id: string;
  continentId: string;
  type: FlowEdgeType;
  startLat: number; startLng: number;
  endLat: number; endLng: number;
  color: string;
  label?: string;
}
```

(`FlowEdgeType` is already exported from `@grasp/schema` — see `schema.ts:14`.)

- [ ] **Step 2: Write the failing test**

Create `packages/dashboard/src/adapters/atlas-arcs.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildAtlasView } from "./atlas";
import type { BriefDoc } from "@grasp/schema";

// Minimal doc with one flow continent (workflows) holding 2 cities + 1 flow city->city.
function docWithFlow(): BriefDoc {
  return {
    meta: { repo: "r", depth: "skim", broadness: "offline", signals: {} },
    brief: { idea: "i", problem: "p", why: "w", how: "h", takeaway: "t" },
    atlas: {
      continents: [
        {
          id: "c_wf", domain: "workflows", title: "Workflows", summary: "s", evidenceIds: [],
          cities: [
            { id: "city_a", name: "Ingest", evidenceIds: [], landmarks: [] },
            { id: "city_b", name: "Render", evidenceIds: [], landmarks: [] },
          ],
          flows: [{ id: "f1", source: "city_a", target: "city_b", type: "next", label: "then" }],
        },
      ],
    },
    landscapeGraph: { nodes: [{ id: "self", type: "self", label: "r" }], edges: [] },
    evidence: [],
  } as unknown as BriefDoc;
}

describe("buildAtlasView flow arcs", () => {
  it("emits one arc per flow with endpoints at the resolved city positions", () => {
    const v = buildAtlasView(docWithFlow());
    expect(v.arcs).toHaveLength(1);
    const arc = v.arcs[0];
    const a = v.cities.find((c) => c.id === "city_a")!;
    const b = v.cities.find((c) => c.id === "city_b")!;
    expect(arc).toMatchObject({
      id: "f1", continentId: "c_wf", type: "next", label: "then",
      startLat: a.lat, startLng: a.lng, endLat: b.lat, endLng: b.lng,
    });
    expect(arc.color).toBe(v.continents.find((c) => c.id === "c_wf")!.color);
  });

  it("is deterministic (same doc → identical arcs)", () => {
    expect(buildAtlasView(docWithFlow()).arcs).toEqual(buildAtlasView(docWithFlow()).arcs);
  });

  it("resolves landmark endpoints too, and skips flows whose endpoint is missing", () => {
    const d = docWithFlow();
    d.atlas.continents[0].cities[0].landmarks = [{ id: "lm_x", name: "X", evidenceIds: [], tags: [] }] as never;
    d.atlas.continents[0].flows = [
      { id: "f2", source: "lm_x", target: "city_b", type: "calls" },
      { id: "f3", source: "nope", target: "city_b", type: "calls" },
    ] as never;
    const v = buildAtlasView(d);
    expect(v.arcs.map((a) => a.id)).toEqual(["f2"]); // f3 dropped (unresolved endpoint)
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test --workspace @grasp/dashboard -- atlas-arcs`
Expected: FAIL (`v.arcs` is empty / shape mismatch).

- [ ] **Step 4: Populate `arcs` in `buildAtlasView`**

Inside `buildAtlasView`, build a position map as cities/landmarks are created, then resolve flows **after** each continent's city loop. Add `const arcs: ArcView[] = [];` near the other accumulators. Inside the `for (const cont …)` loop, before `continents.push(...)`:

```ts
    // Resolve this continent's flows into great-circle arcs. Endpoints are city or
    // landmark ids within THIS continent (guaranteed by validateBrief; skip if missing).
    const posById = new Map<string, { lat: number; lng: number }>();
    for (const c of cities) if (c.continentId === cont.id) posById.set(c.id, { lat: c.lat, lng: c.lng });
    for (const l of landmarks) if (l.continentId === cont.id) posById.set(l.id, { lat: l.lat, lng: l.lng });
    for (const fl of cont.flows) {
      const s = posById.get(fl.source);
      const t = posById.get(fl.target);
      if (!s || !t) continue;
      arcs.push({
        id: fl.id, continentId: cont.id, type: fl.type, label: fl.label,
        startLat: s.lat, startLng: s.lng, endLat: t.lat, endLng: t.lng, color: geo.color,
      });
    }
```

Then change the return to `return { continents, cities, landmarks, arcs, outline };`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test --workspace @grasp/dashboard -- atlas-arcs`
Expected: PASS (3/3). Then run the full dashboard suite to confirm no regressions: `npm test --workspace @grasp/dashboard` (expect all green; existing `atlas.test.ts` still passes since `arcs` was `[]` and is now populated only when flows exist).

- [ ] **Step 6: Commit**

```bash
git add packages/dashboard/src/adapters/atlas.ts packages/dashboard/src/adapters/atlas-arcs.test.ts
git commit -m "feat(dashboard): buildAtlasView emits intra-continent flow arcs"
```

---

## Task 2: Pure LOD + selection-context helpers

**Files:**
- Modify: `packages/dashboard/src/adapters/atlas.ts`
- Test: `packages/dashboard/src/adapters/atlas-arcs.test.ts` (append)

These pure functions move all "what shows at which altitude" logic out of the WebGL component so it's unit-tested, not eyeballed.

- [ ] **Step 1: Write the failing tests** (append to `atlas-arcs.test.ts`)

```ts
import { selectionContext, visibleAt } from "./atlas";

describe("selectionContext", () => {
  const v = buildAtlasView(docWithFlow());
  it("level 1 (orbit) when nothing selected", () => {
    expect(selectionContext(v, null)).toMatchObject({ level: 1, continentId: null });
  });
  it("level 2 (continent) when a continent is selected", () => {
    expect(selectionContext(v, "c_wf")).toMatchObject({ level: 2, continentId: "c_wf" });
  });
  it("level 3 (city) resolves its continent", () => {
    expect(selectionContext(v, "city_a")).toMatchObject({ level: 3, continentId: "c_wf", cityId: "city_a" });
  });
});

describe("visibleAt", () => {
  it("cities show from continent altitude; landmarks+arcs from city altitude", () => {
    expect(visibleAt("city", 1)).toBe(false);
    expect(visibleAt("city", 2)).toBe(true);
    expect(visibleAt("landmark", 2)).toBe(false);
    expect(visibleAt("landmark", 3)).toBe(true);
    expect(visibleAt("arc", 3)).toBe(true);
    expect(visibleAt("arc", 2)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify fail** — `npm test --workspace @grasp/dashboard -- atlas-arcs` → FAIL (functions undefined).

- [ ] **Step 3: Implement the helpers** (append to `atlas.ts`)

```ts
export interface SelectionContext {
  level: 1 | 2 | 3 | 4;
  continentId: string | null;
  cityId: string | null;
  landmarkId: string | null;
  lat: number | null; lng: number | null; // camera target (selected node's position)
}

export function selectionContext(view: AtlasView, selectedId: string | null): SelectionContext {
  const base = { continentId: null, cityId: null, landmarkId: null, lat: null, lng: null };
  if (!selectedId) return { level: 1, ...base };
  const lm = view.landmarks.find((l) => l.id === selectedId);
  if (lm) return { level: 4, continentId: lm.continentId, cityId: lm.cityId, landmarkId: lm.id, lat: lm.lat, lng: lm.lng };
  const city = view.cities.find((c) => c.id === selectedId);
  if (city) return { level: 3, continentId: city.continentId, cityId: city.id, landmarkId: null, lat: city.lat, lng: city.lng };
  const cont = view.continents.find((c) => c.id === selectedId);
  if (cont) return { level: 2, continentId: cont.id, cityId: null, landmarkId: null, lat: cont.lat, lng: cont.lng };
  return { level: 1, ...base };
}

// Level-of-detail gate. Cities appear at Continent altitude (2+); landmarks and
// flow arcs at City altitude (3+).
export function visibleAt(kind: "city" | "landmark" | "arc", level: 1 | 2 | 3 | 4): boolean {
  if (kind === "city") return level >= 2;
  return level >= 3; // landmark, arc
}
```

- [ ] **Step 4: Run to verify pass** — `npm test --workspace @grasp/dashboard -- atlas-arcs` → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/dashboard/src/adapters/atlas.ts packages/dashboard/src/adapters/atlas-arcs.test.ts
git commit -m "feat(dashboard): pure selectionContext + visibleAt LOD helpers"
```

---

## Task 3: Camera fly-to + LOD + flow arcs on the globe

**Files:**
- Modify: `packages/dashboard/src/components/globeImpl.tsx`, `AtlasGlobe.tsx`

> **Note for the implementer:** this task is inherently visual — globe.gl camera easing and layer tuning cannot be unit-tested (jsdom has no WebGL; `GlobeImpl` never mounts in tests). Build it against the **exact globe.gl APIs below**, then **verify in a real browser** with chrome-devtools (acceptance criteria at the end). Do NOT add jsdom tests for `GlobeImpl`; the LOD *logic* is already tested via `visibleAt`/`selectionContext` (Task 2).

- [ ] **Step 1: Thread selection into `GlobeImpl`**

`AtlasGlobe.tsx` already receives `selectedId`/`onSelect`. Pass both through to `GlobeImpl`, plus an `onAscend` (background/up). Update the `GlobeImpl` prop type to `{ view; selectedId: string | null; onSelect: (id: string | null) => void; width; height }`.

- [ ] **Step 2: Camera flight on selection change**

In `globeImpl.tsx`, import the helpers: `import { selectionContext, visibleAt } from "../adapters/atlas";`. Add an effect that flies the camera when `selectedId` changes:

```ts
useEffect(() => {
  const g = globeRef.current;
  if (!g) return;
  const ctx = selectionContext(view, selectedId);
  const ALT = { 1: 2.4, 2: 1.3, 3: 0.6, 4: 0.32 } as const; // altitude per level
  if (ctx.lat != null && ctx.lng != null) {
    g.pointOfView({ lat: ctx.lat, lng: ctx.lng, altitude: ALT[ctx.level] }, 900);
    g.controls().autoRotate = false;          // stop drifting once the user dives in
  } else {
    g.pointOfView({ lat: 18, lng: 45, altitude: ALT[1] }, 900);
    g.controls().autoRotate = true;            // resume idle spin at orbit
  }
}, [selectedId, view]);
```

- [ ] **Step 3: LOD — show/hide city & landmark dots by level**

Replace the static `points` array with a level-filtered one computed from `selectionContext`. Cities show at level ≥2 (only for the focused continent once level ≥2), landmarks at level ≥3 (only the focused city's). Concretely, compute inside the component body:

```ts
const ctx = selectionContext(view, selectedId);
const points = [
  ...(visibleAt("city", ctx.level)
      ? view.cities.filter((c) => !ctx.continentId || c.continentId === ctx.continentId)
      : []
    ).map((c) => ({ id: c.id, lat: c.lat, lng: c.lng, color: c.color, r: 0.3 })),
  ...(visibleAt("landmark", ctx.level)
      ? view.landmarks.filter((l) => !ctx.cityId || l.cityId === ctx.cityId)
      : []
    ).map((l) => ({ id: l.id, lat: l.lat, lng: l.lng, color: l.color, r: 0.18 })),
];
```

- [ ] **Step 4: Flow arc layer (visible at City altitude)**

Add an arcs layer to the `<Globe>`. Compute:

```ts
const arcs = visibleAt("arc", ctx.level)
  ? view.arcs.filter((a) => a.continentId === ctx.continentId)
  : [];
```

Add these props to `<Globe>` (great-circle arcs, animated dash for direction, tinted by continent color):

```tsx
arcsData={arcs}
arcStartLat="startLat" arcStartLng="startLng" arcEndLat="endLat" arcEndLng="endLng"
arcColor={(a: object) => (a as { color: string }).color}
arcStroke={0.5}
arcDashLength={0.4} arcDashGap={0.2} arcDashAnimateTime={1800}
arcAltitudeAutoScale={0.4}
onArcClick={(a) => onSelect((a as { id: string }).id)}
```

- [ ] **Step 5: Sprite LOD (continent sprites fade as you dive)**

In the per-frame rAF loop (existing), reduce non-focused continent sprite opacity once `ctx.level >= 2`: if `ctx.continentId && c.id !== ctx.continentId`, set the target opacity to `0.15` instead of `1`. Keep the focused continent's sprite full. (Pure style mutation; no new state.)

- [ ] **Step 6: Background click ascends one level**

Add to `<Globe>`: `onGlobeClick={() => onSelect(null)}`. (Clicking empty globe → back to orbit. Point/arc clicks still select via their own handlers, which fire first.) Per-level "up one" is handled by the breadcrumb/rail in Task 5; globe background = straight to orbit, which is the simplest correct behavior.

- [ ] **Step 7: Default export for lazy-loading**

At the bottom of `AtlasGlobe.tsx` add `export default AtlasGlobe;` (keep the named export too). Needed by Task 6.

- [ ] **Step 8: Typecheck + build + browser-verify**

```bash
npx tsc --noEmit -p packages/dashboard
npm run build --workspace @grasp/dashboard
cp -f /tmp/osz-atlas-brief.json packages/dashboard/dist/repo-brief.json
( cd packages/dashboard/dist && python3 -m http.server 8931 --bind 127.0.0.1 ) &
```

Open `http://localhost:8931/index.html` with chrome-devtools. **Acceptance criteria (all must hold):**
1. Orbit: idle auto-rotate; only continent sprites + their captions; no city/landmark dots.
2. Click a continent sprite → camera **flies** to it, auto-rotate stops, its **city** dots appear, other continents' sprites dim.
3. Click a city dot → camera flies closer; that city's **landmark** dots appear; for a flow continent (Workflows/Business Flows) **arcs** render between nodes with an animated dash.
4. Click a landmark dot → detail panel (Task 4) populates.
5. Click empty globe → returns to orbit (dots/arcs clear, auto-rotate resumes).
6. **Console:** no *new* errors vs. the known multi-three warning + favicon 404.

- [ ] **Step 9: Commit**

```bash
git add packages/dashboard/src/components/globeImpl.tsx packages/dashboard/src/components/AtlasGlobe.tsx
git commit -m "feat(dashboard): camera fly-to altitude LOD + flow arcs on the globe"
```

---

## Task 4: Per-altitude detail panel

**Files:**
- Modify: `packages/dashboard/src/components/AtlasDetail.tsx`, `App.tsx`
- Test: `packages/dashboard/src/components/AtlasDetail.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/dashboard/src/components/AtlasDetail.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AtlasDetail } from "./AtlasDetail";
import type { ContinentView, CityView, LandmarkView } from "../adapters/atlas";

const cont: ContinentView = { id: "c", domain: "workflows", title: "Workflows", summary: "How runtime flows.", continentName: "North America", motif: "Statue of Liberty", lat: 0, lng: 0, color: "#5aa9f0", cityCount: 1, landmarkCount: 0, evidence: [] };
const city: CityView = { id: "ci", continentId: "c", name: "Ingest", summary: "Reads input.", lat: 0, lng: 0, color: "#5aa9f0", evidence: [] };
const lm: LandmarkView = { id: "l", cityId: "ci", continentId: "c", name: "Parser", detail: "Parses.", whyItMatters: "Determinism.", techTag: "Zod", tags: ["x"], lat: 0, lng: 0, color: "#5aa9f0", evidence: [] };

describe("AtlasDetail per altitude", () => {
  it("shows the empty prompt when nothing is selected", () => {
    render(<AtlasDetail node={null} />);
    expect(screen.getByText(/select a/i)).toBeInTheDocument();
  });
  it("renders a continent summary", () => {
    render(<AtlasDetail node={{ kind: "continent", continent: cont }} />);
    expect(screen.getByText("How runtime flows.")).toBeInTheDocument();
    expect(screen.getByText(/continent/i)).toBeInTheDocument();
  });
  it("renders a city summary", () => {
    render(<AtlasDetail node={{ kind: "city", city }} />);
    expect(screen.getByText("Reads input.")).toBeInTheDocument();
  });
  it("renders the full landmark (why it matters)", () => {
    render(<AtlasDetail node={{ kind: "landmark", landmark: lm }} />);
    expect(screen.getByText("Determinism.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify fail** — `npm test --workspace @grasp/dashboard -- AtlasDetail` → FAIL (`AtlasDetail` takes `landmark`, not `node`).

- [ ] **Step 3: Generalize `AtlasDetail`**

Rewrite `AtlasDetail.tsx` to take a discriminated `node` union (keep `EvidenceChips`):

```tsx
import type { ContinentView, CityView, LandmarkView } from "../adapters/atlas";
import { EvidenceChips } from "./EvidenceChips";

export type DetailNode =
  | { kind: "continent"; continent: ContinentView }
  | { kind: "city"; city: CityView }
  | { kind: "landmark"; landmark: LandmarkView }
  | null;

export function AtlasDetail({ node }: { node: DetailNode }) {
  if (!node) {
    return (
      <aside className="atlas-detail" data-testid="atlas-detail">
        <p className="atlas-detail-empty">Select a landmark to see why it matters.</p>
      </aside>
    );
  }
  if (node.kind === "continent") {
    const c = node.continent;
    return (
      <aside className="atlas-detail" data-testid="atlas-detail">
        <span className="atlas-detail-kind">Continent</span>
        <h3>{c.title} <span className="atlas-tech">{c.continentName}</span></h3>
        <p>{c.summary}</p>
        <p className="atlas-detail-counts">{c.cityCount} cities · {c.landmarkCount} landmarks</p>
        <EvidenceChips evidence={c.evidence} />
      </aside>
    );
  }
  if (node.kind === "city") {
    const c = node.city;
    return (
      <aside className="atlas-detail" data-testid="atlas-detail">
        <span className="atlas-detail-kind">City</span>
        <h3>{c.name}</h3>
        {c.summary && <p>{c.summary}</p>}
        <EvidenceChips evidence={c.evidence} />
      </aside>
    );
  }
  const landmark = node.landmark;
  return (
    <aside className="atlas-detail" data-testid="atlas-detail">
      <span className="atlas-detail-kind">Landmark</span>
      <h3>{landmark.name}{landmark.techTag && <span className="atlas-tech">{landmark.techTag}</span>}</h3>
      {landmark.detail && <p>{landmark.detail}</p>}
      {landmark.whyItMatters && (
        <div className="atlas-why"><span className="atlas-why-label">Why it matters</span><p>{landmark.whyItMatters}</p></div>
      )}
      {landmark.tags.length > 0 && (
        <ul className="atlas-tags">{landmark.tags.map((t) => (<li key={t}>{t}</li>))}</ul>
      )}
      <EvidenceChips evidence={landmark.evidence} />
    </aside>
  );
}
```

- [ ] **Step 4: Build the `node` in `App.tsx`**

Replace the `landmark` lookup + `<AtlasDetail landmark={landmark} />` with a resolved node from `selectionContext`:

```tsx
import { buildAtlasView, selectionContext } from "./adapters/atlas";
import { AtlasDetail, type DetailNode } from "./components/AtlasDetail";
// ...
const ctx = useMemo(() => selectionContext(view, selectedId), [view, selectedId]);
const detailNode: DetailNode = useMemo(() => {
  if (ctx.landmarkId) { const l = view.landmarks.find((x) => x.id === ctx.landmarkId); return l ? { kind: "landmark", landmark: l } : null; }
  if (ctx.cityId) { const c = view.cities.find((x) => x.id === ctx.cityId); return c ? { kind: "city", city: c } : null; }
  if (ctx.continentId) { const c = view.continents.find((x) => x.id === ctx.continentId); return c ? { kind: "continent", continent: c } : null; }
  return null;
}, [ctx, view]);
const level = ctx.level;
```

Use `<AtlasDetail node={detailNode} />` and `<AltitudeRail level={level} onAscend={...} />` (Task 5). Remove the now-redundant local `landmark`/`level` derivations (the `crumb` memo stays).

- [ ] **Step 5: Run tests + typecheck**

Run: `npm test --workspace @grasp/dashboard` (expect all green, incl. the new file; `App.test.tsx` may reference the old prop — update it if it asserts `landmark=`). Then `npx tsc --noEmit -p packages/dashboard`.

- [ ] **Step 6: Commit**

```bash
git add packages/dashboard/src/components/AtlasDetail.tsx packages/dashboard/src/components/AtlasDetail.test.tsx packages/dashboard/src/App.tsx
git commit -m "feat(dashboard): per-altitude detail panel (continent/city/landmark)"
```

---

## Task 5: Clickable altitude rail (ascend)

**Files:**
- Modify: `packages/dashboard/src/components/AltitudeRail.tsx`, `App.tsx`
- Test: `packages/dashboard/src/components/components.test.tsx` (append a case)

- [ ] **Step 1: Write the failing test** (append to `components.test.tsx`)

```tsx
it("AltitudeRail ascends to a lower level when an earlier step is clicked", async () => {
  const onAscend = vi.fn();
  render(<AltitudeRail level={4} onAscend={onAscend} />);
  await userEvent.click(screen.getByRole("button", { name: /Continent/ }));
  expect(onAscend).toHaveBeenCalledWith(2);
});
```

(Ensure `AltitudeRail`, `vi`, `userEvent`, `render`, `screen` are imported in that file.)

- [ ] **Step 2: Run to verify fail** — `npm test --workspace @grasp/dashboard -- components` → FAIL.

- [ ] **Step 3: Make earlier steps buttons**

Rewrite `AltitudeRail.tsx` so steps at `n < level` are ascend buttons; the current step is static; deeper steps are disabled:

```tsx
const STEPS = [
  { n: 1, label: "Orbit", caption: "Whole product" },
  { n: 2, label: "Continent", caption: "Explore one" },
  { n: 3, label: "City", caption: "Landmarks & flows" },
  { n: 4, label: "Landmark", caption: "Details & evidence" },
] as const;

export function AltitudeRail({ level, onAscend }: { level: 1 | 2 | 3 | 4; onAscend?: (n: 1 | 2 | 3 | 4) => void }) {
  return (
    <ol className="altitude-rail" data-testid="altitude-rail">
      {STEPS.map((s) => {
        const canAscend = onAscend && s.n < level;
        const inner = (<>
          <span className="rail-n">{s.n}</span>
          <span className="rail-label">{s.label}</span>
          <span className="rail-caption">{s.caption}</span>
        </>);
        return (
          <li key={s.n} className={s.n === level ? "active" : ""} aria-current={s.n === level ? "step" : undefined}>
            {canAscend
              ? <button type="button" className="rail-step-btn" onClick={() => onAscend!(s.n as 1 | 2 | 3 | 4)}>{inner}</button>
              : inner}
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 4: Wire ascend in `App.tsx`**

Ascending to level N means selecting the ancestor at that level (or null for orbit). Add:

```tsx
const ascendTo = (n: 1 | 2 | 3 | 4) => {
  if (n <= 1) return setSelectedId(null);
  if (n === 2) return setSelectedId(ctx.continentId);
  if (n === 3) return setSelectedId(ctx.cityId ?? ctx.continentId);
};
```

Pass `onAscend={ascendTo}` to `<AltitudeRail level={level} onAscend={ascendTo} />`.

- [ ] **Step 5: Run tests** — `npm test --workspace @grasp/dashboard` → all green.

- [ ] **Step 6: Commit**

```bash
git add packages/dashboard/src/components/AltitudeRail.tsx packages/dashboard/src/components/components.test.tsx packages/dashboard/src/App.tsx
git commit -m "feat(dashboard): clickable altitude rail ascends levels"
```

---

## Task 6: `atlasToMermaid` flow diagrams in the export

**Files:**
- Modify: `packages/export/src/mermaid.ts`, `markdown.ts`, `atlasToHtml.ts`, `index.ts` (already barrels `mermaid`)
- Test: `packages/export/src/atlasToMermaid.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/export/src/atlasToMermaid.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { atlasToMermaid } from "./mermaid";
import type { BriefDoc } from "@grasp/schema";

function doc(): BriefDoc {
  return {
    meta: { repo: "r", depth: "skim", broadness: "offline", signals: {} },
    brief: { idea: "i", problem: "p", why: "w", how: "h", takeaway: "t" },
    atlas: { continents: [
      { id: "c_wf", domain: "workflows", title: "Workflows", summary: "s", evidenceIds: [],
        cities: [{ id: "a", name: "Ingest", evidenceIds: [], landmarks: [] }, { id: "b", name: "Render <x>", evidenceIds: [], landmarks: [] }],
        flows: [{ id: "f1", source: "a", target: "b", type: "next", label: "then" }] },
      { id: "c_arch", domain: "architecture", title: "Architecture", summary: "s", evidenceIds: [], cities: [], flows: [] },
    ] },
    landscapeGraph: { nodes: [{ id: "self", type: "self", label: "r" }], edges: [] },
    evidence: [],
  } as unknown as BriefDoc;
}

describe("atlasToMermaid", () => {
  it("emits one diagram per continent that HAS flows", () => {
    const out = atlasToMermaid(doc());
    expect(out).toHaveLength(1);
    expect(out[0].continentTitle).toBe("Workflows");
    expect(out[0].diagram).toMatch(/^flowchart LR/);
    expect(out[0].diagram).toContain('a["Ingest"]');
    expect(out[0].diagram).toContain("a -->|next| b");
  });
  it("escapes untrusted node labels", () => {
    const out = atlasToMermaid(doc());
    expect(out[0].diagram).toContain("Render &lt;x&gt;"); // not a raw <x>
    expect(out[0].diagram).not.toContain("Render <x>");
  });
  it("returns [] when no continent has flows", () => {
    const d = doc(); d.atlas.continents[0].flows = [] as never;
    expect(atlasToMermaid(d)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify fail** — `npm test --workspace @grasp/export -- atlasToMermaid` → FAIL.

- [ ] **Step 3: Implement `atlasToMermaid` in `mermaid.ts`** (reuses file-private `label`/`nodeId`)

Append to `packages/export/src/mermaid.ts`:

```ts
export interface AtlasFlowDiagram { continentTitle: string; diagram: string; }

/** One Mermaid flowchart per continent that has flows. Node labels = the referenced
 *  city/landmark names (escaped); edges = `source -->|type| target` with optional label. */
export function atlasToMermaid(doc: BriefDoc): AtlasFlowDiagram[] {
  const out: AtlasFlowDiagram[] = [];
  for (const c of doc.atlas.continents) {
    if (c.flows.length === 0) continue;
    const nameById = new Map<string, string>();
    for (const city of c.cities) {
      nameById.set(city.id, city.name);
      for (const lm of city.landmarks) nameById.set(lm.id, lm.name);
    }
    const lines = ["flowchart LR"];
    const seen = new Set<string>();
    const emitNode = (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      lines.push(`  ${nodeId(id)}["${label(nameById.get(id) ?? id)}"]`);
    };
    for (const fl of c.flows) { emitNode(fl.source); emitNode(fl.target); }
    for (const fl of c.flows) {
      const lbl = fl.label ? ` ${label(fl.label)} ` : ` ${fl.type} `;
      lines.push(`  ${nodeId(fl.source)} -->|${lbl.trim()}| ${nodeId(fl.target)}`);
    }
    out.push({ continentTitle: c.title, diagram: lines.join("\n") });
  }
  return out;
}
```

- [ ] **Step 4: Run to verify pass** — `npm test --workspace @grasp/export -- atlasToMermaid` → PASS.

- [ ] **Step 5: Wire into `report.md`** (`markdown.ts`)

After `out.push(atlasToMarkdown(doc));` add the flow diagrams:

```ts
import { landscapeToMermaid, atlasToMermaid } from "./mermaid";
// ...
out.push(atlasToMarkdown(doc));
for (const f of atlasToMermaid(doc)) {
  out.push(`### Flows — ${f.continentTitle}`, "", "```mermaid", f.diagram, "```", "");
}
```

- [ ] **Step 6: Wire into `report.html`** (`atlasToHtml.ts`)

HTML export is self-contained (no mermaid runtime), so render flows as a semantic list, not a diagram. Before the closing `</article>` for each continent, append its flows:

```ts
// inside the `for (const c of doc.atlas.continents)` loop, after the cities loop:
if (c.flows.length) {
  const nameById = new Map<string, string>();
  for (const city of c.cities) { nameById.set(city.id, city.name); for (const lm of city.landmarks) nameById.set(lm.id, lm.name); }
  parts.push(`<ol class="flows">`);
  for (const fl of c.flows) {
    const s = esc(nameById.get(fl.source) ?? fl.source);
    const t = esc(nameById.get(fl.target) ?? fl.target);
    const lbl = esc(fl.label ?? fl.type);
    parts.push(`<li>${s} <span class="flow-type">${lbl}</span> → ${t}</li>`);
  }
  parts.push(`</ol>`);
}
```

- [ ] **Step 7: Run the full export suite + typecheck**

Run: `npm test --workspace @grasp/export` (expect all green; existing markdown/html snapshot-style tests may need the new sections added to expectations — update them to match). Then `npx tsc --noEmit -p packages/export`.

- [ ] **Step 8: Commit**

```bash
git add packages/export/src/mermaid.ts packages/export/src/atlasToMermaid.test.ts packages/export/src/markdown.ts packages/export/src/atlasToHtml.ts
git commit -m "feat(export): atlasToMermaid flow diagrams in report.md + flows list in report.html"
```

---

## Task 7: Lazy-load the globe + sprite perf pass

**Files:**
- Modify: `packages/dashboard/src/App.tsx`
- Asset step: `packages/dashboard/public/atlas/landmarks/*.png`

- [ ] **Step 1: Lazy-load `AtlasGlobe`**

In `App.tsx`, replace the static import with a lazy one and wrap the render in `<Suspense>`:

```tsx
import { lazy, Suspense, useMemo, useState } from "react";
const AtlasGlobe = lazy(() => import("./components/AtlasGlobe"));
// ...
{listView ? (
  <AtlasOutline view={view} selectedId={selectedId} onSelect={setSelectedId} />
) : (
  <Suspense fallback={<div className="atlas-globe" data-testid="atlas-globe-loading">Loading globe…</div>}>
    <AtlasGlobe view={view} selectedId={selectedId} onSelect={setSelectedId} />
  </Suspense>
)}
```

(Requires the `export default AtlasGlobe;` added in Task 3 Step 7.)

- [ ] **Step 2: Verify the chunk split**

Run: `npm run build --workspace @grasp/dashboard`
Expected: the output now lists a **separate** large chunk (three/globe.gl ≈ 2 MB) split from the main `index-*.js`, and the main chunk shrinks substantially. The 500 kB warning may now point only at the globe chunk, which is loaded on demand.

- [ ] **Step 3: Confirm tests still pass**

Run: `npm test --workspace @grasp/dashboard`
Expected: all green. In jsdom, `AtlasGlobe` still resolves (lazy import works in Vitest); if any test now needs to await Suspense, wrap the assertion in `await screen.findBy…`. `webglAvailable()` is false in jsdom so the outline fallback path is unchanged.

- [ ] **Step 4: Sprite size pass (optional, asset-only)**

The 6 sprites are 512² (~1.3 MB). Quantize to a palette PNG to roughly halve again (ImageMagick is installed; masters are in `packages/dashboard/atlas-sprite-src/keyed-1024/`):

```bash
cd packages/dashboard/public/atlas/landmarks
for f in *.png; do magick "$f" -dither FloydSteinberg -colors 200 -strip "$f"; done
du -sh .   # expect ~0.6–0.8 MB total
```

Spot-check one on the dark background for banding (`magick -size 512x512 xc:'#0c0e12' modules.png -composite /tmp/check.png` and view). If a gradient bands badly, raise `-colors` for that file or revert it from the master. Rebuild so `dist/` picks up the smaller assets.

- [ ] **Step 5: Commit**

```bash
git add packages/dashboard/src/App.tsx packages/dashboard/public/atlas/landmarks
git commit -m "perf(dashboard): lazy-load globe chunk + quantize landmark sprites"
```

---

## Out of scope (deferred to Phase 3 or noted)

- **Cross-continent flow arcs** — requires the schema change above; not done unless you flip the decision.
- **Unifying the two three.js copies** (globe.gl@0.184 vs three-globe@0.170) — the multi-instance *warning* is benign with the DOM-overlay approach; a dedupe risks the earlier `Timer`/`webgpu` build breakage. Left as a separate spike, not a Phase 2 task.
- **Antarctica "uncharted"** continent (spec §3) — optional, not requested.
- **`atlasToSvg`** static flow graph for report.html — Mermaid (report.md) + the HTML flows list cover the need; a full static SVG flow renderer is omitted.

---

## Self-Review (done at authoring)

- **Spec coverage (§10 Phase 2):** flow arcs ✓ (Tasks 1–3), camera/LOD ✓ (Tasks 2–5, the spec's altitude ladder), landmark art ✓ (sprites done this session; LOD + perf here), `atlasToMermaid` ✓ (Task 6), perf/lazy-load ✓ (Task 7). Idle auto-rotate already shipped; smoother camera easing = the 900 ms `pointOfView` transitions in Task 3.
- **Type consistency:** `selectionContext`/`visibleAt`/`ArcView`/`DetailNode` names are used identically across tasks. `AtlasGlobe` gains a default export (Task 3) before it's lazily imported (Task 7).
- **Placeholder scan:** no TBDs; every code step shows the code. The two visual tasks (3, and the asset step in 7) name exact globe.gl props / shell commands and concrete acceptance criteria instead of unit tests, because jsdom can't mount WebGL — consistent with how Phase 1's globe was verified.
- **Testing seam:** all branching logic (arc resolution, LOD gating, selection→level, mermaid structure/escaping, detail-panel variants, rail ascend) is unit-tested; only camera easing/visual polish is browser-verified.
