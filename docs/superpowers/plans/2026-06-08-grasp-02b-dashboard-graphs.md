# Grasp — Plan 2b: Dashboard Graphs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the two interactive graphs to the dashboard — an inward **concept map** (radial hub-and-spoke around the core idea) and an outward **competitive landscape** (alternatives placed by similarity to the analyzed repo) — wired below the prose cards via a tab toggle, each with a click-to-select detail panel that reuses the evidence chips.

**Architecture:** Pure, deterministic layout adapters (`layoutConcept`, `layoutLandscape`) turn a `BriefDoc` graph into positioned view models (analytical radial math — no force simulation, no new dependencies, identical output every run). Hand-rolled SVG components render nodes/edges and, on node click, show a detail panel (label, detail/oneLiner, meta, `EvidenceChips`, and a "View on GitHub" link for alternatives). The `App` gains a tab toggle (Concept | Landscape) below the existing cards.

**Tech Stack:** React 18, Vite 5, TypeScript, Vitest + jsdom + @testing-library/react. No new runtime dependencies — both layouts are pure math.

**This is Plan 2b**, building on Plan 2 (dashboard brief view, merged). Depends on `@grasp/schema` (which exports `ConceptNodeType`/`LandscapeNodeType` union types and the graph data on `BriefDoc`) and the existing `resolveEvidence`/`EvidenceChips`.

Spec: `docs/superpowers/specs/2026-06-08-grasp-design.md` — §4 (graph node/edge types), §5 zone 3 (the two graphs).

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/dashboard/src/adapters/concept.ts` | `layoutConcept` + `ConceptNodeVM`/`ConceptLayout`/`GraphEdgeVM` types |
| `packages/dashboard/src/adapters/landscape.ts` | `layoutLandscape` + `LandscapeNodeVM`/`CategoryVM`/`LandscapeLayout` types |
| `packages/dashboard/src/components/ConceptGraph.tsx` | SVG concept map + click-to-select detail panel |
| `packages/dashboard/src/components/LandscapeGraph.tsx` | SVG landscape + detail panel + category legend + GitHub link |
| `packages/dashboard/src/index.css` (modify) | graph styles (svg, nodes, edges, detail panel, legend, tabs) |
| `packages/dashboard/src/App.tsx` (modify) | tab toggle wiring the two graphs below the cards |
| tests | colocated `*.test.ts(x)` |

`GraphEdgeVM` is defined once in `concept.ts` and imported by `landscape.ts` and both components.

---

## Task 1: Concept layout adapter (`layoutConcept`)

A pure function: the `idea` node at center, all other nodes on a ring ordered by type priority then input order. Deterministic.

**Files:**
- Create: `packages/dashboard/src/adapters/concept.ts`
- Test: `packages/dashboard/src/adapters/concept.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/dashboard/src/adapters/concept.test.ts`:

```ts
import { layoutConcept } from "./concept";
import { sampleDoc } from "../test-utils/sample";

describe("layoutConcept", () => {
  it("places the idea node at the center", () => {
    const layout = layoutConcept(sampleDoc, 640, 480);
    const idea = layout.nodes.find((n) => n.type === "idea")!;
    expect(idea).toBeDefined();
    expect(idea.x).toBe(320);
    expect(idea.y).toBe(240);
  });

  it("includes every concept node and edge with finite coordinates", () => {
    const layout = layoutConcept(sampleDoc, 640, 480);
    expect(layout.nodes).toHaveLength(sampleDoc.conceptGraph.nodes.length);
    expect(layout.edges).toHaveLength(sampleDoc.conceptGraph.edges.length);
    for (const n of layout.nodes) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
    }
  });

  it("resolves node evidence (the outcome node cites ev1)", () => {
    const layout = layoutConcept(sampleDoc, 640, 480);
    const outcome = layout.nodes.find((n) => n.id === "o1")!;
    expect(outcome.evidence.map((e) => e.id)).toEqual(["ev1"]);
  });

  it("is deterministic (same input → identical coordinates)", () => {
    const a = layoutConcept(sampleDoc, 640, 480);
    const b = layoutConcept(sampleDoc, 640, 480);
    expect(a.nodes.map((n) => [n.id, n.x, n.y])).toEqual(b.nodes.map((n) => [n.id, n.x, n.y]));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test --workspace @grasp/dashboard`
Expected: FAIL — cannot resolve `./concept`.

- [ ] **Step 3: Implement the adapter**

Create `packages/dashboard/src/adapters/concept.ts`:

```ts
import type { BriefDoc, ConceptNodeType } from "@grasp/schema";
import { resolveEvidence, type EvidenceChip } from "./brief";

export interface GraphEdgeVM {
  id: string;
  source: string;
  target: string;
  type: string;
}

export interface ConceptNodeVM {
  id: string;
  type: ConceptNodeType;
  label: string;
  detail: string;
  x: number;
  y: number;
  evidence: EvidenceChip[];
}

export interface ConceptLayout {
  nodes: ConceptNodeVM[];
  edges: GraphEdgeVM[];
  width: number;
  height: number;
}

// Ring placement order for non-idea nodes (problem opposite the mechanisms, etc.).
const TYPE_ORDER: ConceptNodeType[] = ["problem", "mechanism", "outcome", "feature"];

export function layoutConcept(doc: BriefDoc, width = 640, height = 480): ConceptLayout {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) / 2 - 60;

  const ideaNode = doc.conceptGraph.nodes.find((n) => n.type === "idea")!;
  const others = doc.conceptGraph.nodes
    .filter((n) => n.type !== "idea")
    .map((n, i) => ({ n, i }))
    .sort((a, b) => TYPE_ORDER.indexOf(a.n.type) - TYPE_ORDER.indexOf(b.n.type) || a.i - b.i)
    .map(({ n }) => n);

  const nodes: ConceptNodeVM[] = [
    {
      id: ideaNode.id,
      type: ideaNode.type,
      label: ideaNode.label,
      detail: ideaNode.detail,
      x: cx,
      y: cy,
      evidence: resolveEvidence(doc, ideaNode.evidenceIds),
    },
  ];

  const count = Math.max(others.length, 1);
  others.forEach((node, i) => {
    const angle = -Math.PI / 2 + (i / count) * 2 * Math.PI;
    nodes.push({
      id: node.id,
      type: node.type,
      label: node.label,
      detail: node.detail,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      evidence: resolveEvidence(doc, node.evidenceIds),
    });
  });

  const edges: GraphEdgeVM[] = doc.conceptGraph.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: e.type,
  }));

  return { nodes, edges, width, height };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --workspace @grasp/dashboard && npm run typecheck --workspace @grasp/dashboard`
Expected: all pass (prior 13 + 4 new concept tests); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add packages/dashboard/src/adapters/concept.ts packages/dashboard/src/adapters/concept.test.ts
git commit -m "feat(dashboard): add deterministic concept graph layout adapter"
```

---

## Task 2: Landscape layout adapter (`layoutLandscape`)

A pure function: `self` at center; `alternative` nodes on a ring at radius ∝ `(1 − similarity)` (more similar → closer), colored by category; `category` nodes become a legend (not physical nodes); edges filtered to those whose endpoints are physical nodes.

**Files:**
- Create: `packages/dashboard/src/adapters/landscape.ts`
- Test: `packages/dashboard/src/adapters/landscape.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/dashboard/src/adapters/landscape.test.ts`:

```ts
import { layoutLandscape } from "./landscape";
import { sampleDoc } from "../test-utils/sample";

describe("layoutLandscape", () => {
  it("places the self node at the center", () => {
    const layout = layoutLandscape(sampleDoc, 640, 480);
    const self = layout.nodes.find((n) => n.kind === "self")!;
    expect(self.id).toBe("self1");
    expect(self.x).toBe(320);
    expect(self.y).toBe(240);
  });

  it("includes self + alternatives as physical nodes but NOT category nodes", () => {
    const layout = layoutLandscape(sampleDoc, 640, 480);
    expect(layout.nodes.map((n) => n.id).sort()).toEqual(["alt1", "alt2", "self1"]);
    expect(layout.nodes.some((n) => n.kind === "category")).toBe(false);
  });

  it("exposes category nodes as a legend with colors", () => {
    const layout = layoutLandscape(sampleDoc, 640, 480);
    expect(layout.categories).toHaveLength(1);
    expect(layout.categories[0]).toMatchObject({ id: "cat1", label: "Code comprehension tools" });
    expect(typeof layout.categories[0].color).toBe("string");
  });

  it("places a more similar alternative closer to center than a less similar one", () => {
    const layout = layoutLandscape(sampleDoc, 640, 480);
    const cx = 320;
    const cy = 240;
    const dist = (id: string) => {
      const n = layout.nodes.find((x) => x.id === id)!;
      return Math.hypot(n.x - cx, n.y - cy);
    };
    // alt2 similarity 0.7 (closer) vs alt1 similarity 0.55 (farther)
    expect(dist("alt2")).toBeLessThan(dist("alt1"));
  });

  it("keeps only edges whose endpoints are physical nodes", () => {
    const layout = layoutLandscape(sampleDoc, 640, 480);
    const ids = new Set(layout.nodes.map((n) => n.id));
    for (const e of layout.edges) {
      expect(ids.has(e.source) && ids.has(e.target)).toBe(true);
    }
    expect(layout.edges).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test --workspace @grasp/dashboard`
Expected: FAIL — cannot resolve `./landscape`.

- [ ] **Step 3: Implement the adapter**

Create `packages/dashboard/src/adapters/landscape.ts`:

```ts
import type { BriefDoc, LandscapeNodeType } from "@grasp/schema";
import { resolveEvidence, type EvidenceChip } from "./brief";
import type { GraphEdgeVM } from "./concept";

export interface LandscapeNodeVM {
  id: string;
  kind: LandscapeNodeType;
  label: string;
  x: number;
  y: number;
  url?: string;
  stars?: number;
  similarity?: number;
  differentiator?: string;
  oneLiner?: string;
  categoryId?: string;
  color: string;
  evidence: EvidenceChip[];
}

export interface CategoryVM {
  id: string;
  label: string;
  color: string;
}

export interface LandscapeLayout {
  nodes: LandscapeNodeVM[];
  edges: GraphEdgeVM[];
  categories: CategoryVM[];
  width: number;
  height: number;
}

const CATEGORY_COLORS = ["#5aa9f0", "#5bd1a0", "#b794f6", "#e5687a", "#f5c451"];
const SELF_COLOR = "#f5c451";
const DEFAULT_COLOR = "#9aa3b2";

export function layoutLandscape(doc: BriefDoc, width = 640, height = 480): LandscapeLayout {
  const cx = width / 2;
  const cy = height / 2;
  const minR = 70;
  const maxR = Math.min(width, height) / 2 - 60;

  const categories: CategoryVM[] = doc.landscapeGraph.nodes
    .filter((n) => n.type === "category")
    .map((c, i) => ({
      id: c.id,
      label: c.label ?? c.id,
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    }));
  const colorFor = (categoryId?: string) =>
    categories.find((c) => c.id === categoryId)?.color ?? DEFAULT_COLOR;

  const selfNode = doc.landscapeGraph.nodes.find((n) => n.type === "self")!;
  const alternatives = doc.landscapeGraph.nodes.filter((n) => n.type === "alternative");

  const nodes: LandscapeNodeVM[] = [
    {
      id: selfNode.id,
      kind: selfNode.type,
      label: selfNode.name ?? selfNode.label ?? selfNode.id,
      x: cx,
      y: cy,
      url: selfNode.url,
      stars: selfNode.stars,
      categoryId: selfNode.category,
      color: SELF_COLOR,
      evidence: resolveEvidence(doc, selfNode.evidenceIds),
    },
  ];

  const count = Math.max(alternatives.length, 1);
  alternatives.forEach((alt, i) => {
    const angle = -Math.PI / 2 + (i / count) * 2 * Math.PI;
    const similarity = alt.similarity ?? 0.5;
    const r = minR + (1 - similarity) * (maxR - minR);
    nodes.push({
      id: alt.id,
      kind: alt.type,
      label: alt.name ?? alt.label ?? alt.id,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      url: alt.url,
      stars: alt.stars,
      similarity: alt.similarity,
      differentiator: alt.differentiator,
      oneLiner: alt.oneLiner,
      categoryId: alt.category,
      color: colorFor(alt.category),
      evidence: resolveEvidence(doc, alt.evidenceIds),
    });
  });

  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges: GraphEdgeVM[] = doc.landscapeGraph.edges
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
    .map((e) => ({ id: e.id, source: e.source, target: e.target, type: e.type }));

  return { nodes, edges, categories, width, height };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --workspace @grasp/dashboard && npm run typecheck --workspace @grasp/dashboard`
Expected: all pass (prior + 5 new landscape tests); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add packages/dashboard/src/adapters/landscape.ts packages/dashboard/src/adapters/landscape.test.ts
git commit -m "feat(dashboard): add deterministic landscape graph layout adapter"
```

---

## Task 3: ConceptGraph component + graph styles

SVG concept map; clicking a node selects it; a detail panel shows the selected node's label, type, detail, and evidence chips. Default selection is the idea node. This task also adds ALL graph CSS (used by both graph components and the tabs).

**Files:**
- Create: `packages/dashboard/src/components/ConceptGraph.tsx`
- Modify: `packages/dashboard/src/index.css`
- Test: `packages/dashboard/src/components/ConceptGraph.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `packages/dashboard/src/components/ConceptGraph.test.tsx`:

```tsx
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ConceptGraph } from "./ConceptGraph";
import { sampleDoc } from "../test-utils/sample";

describe("ConceptGraph", () => {
  it("renders a node element for every concept node", () => {
    render(<ConceptGraph doc={sampleDoc} />);
    for (const n of sampleDoc.conceptGraph.nodes) {
      expect(screen.getByTestId(`concept-node-${n.id}`)).toBeInTheDocument();
    }
  });

  it("defaults the detail panel to the idea node", () => {
    render(<ConceptGraph doc={sampleDoc} />);
    const detail = screen.getByTestId("concept-detail");
    expect(within(detail).getByRole("heading")).toHaveTextContent("Repo as an interactive knowledge graph");
  });

  it("selects a node on click and shows its detail + evidence", () => {
    render(<ConceptGraph doc={sampleDoc} />);
    fireEvent.click(screen.getByTestId("concept-node-o1"));
    const detail = screen.getByTestId("concept-detail");
    expect(within(detail).getByRole("heading")).toHaveTextContent("Interactive architecture dashboard");
    // o1 cites ev1
    expect(within(detail).getAllByTestId("evidence-chip")).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test --workspace @grasp/dashboard`
Expected: FAIL — cannot resolve `./ConceptGraph`.

- [ ] **Step 3: Implement the component**

Create `packages/dashboard/src/components/ConceptGraph.tsx`:

```tsx
import { useState } from "react";
import type { BriefDoc } from "@grasp/schema";
import { layoutConcept } from "../adapters/concept";
import { EvidenceChips } from "./EvidenceChips";

const TYPE_COLORS: Record<string, string> = {
  problem: "var(--problem)",
  idea: "var(--idea)",
  mechanism: "var(--how)",
  outcome: "var(--why)",
  feature: "var(--takeaway)",
};

export function ConceptGraph({ doc }: { doc: BriefDoc }) {
  const layout = layoutConcept(doc);
  const idea = layout.nodes.find((n) => n.type === "idea")!;
  const [selectedId, setSelectedId] = useState<string>(idea.id);
  const selected = layout.nodes.find((n) => n.id === selectedId) ?? idea;
  const byId = new Map(layout.nodes.map((n) => [n.id, n]));

  return (
    <div className="graph-view" data-testid="concept-graph">
      <svg
        className="graph-svg"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="img"
        aria-label="Concept map"
      >
        {layout.edges.map((e) => {
          const s = byId.get(e.source);
          const t = byId.get(e.target);
          if (!s || !t) return null;
          return <line key={e.id} className="graph-edge" x1={s.x} y1={s.y} x2={t.x} y2={t.y} />;
        })}
        {layout.nodes.map((n) => (
          <g
            key={n.id}
            data-testid={`concept-node-${n.id}`}
            className={`graph-node${n.id === selectedId ? " selected" : ""}`}
            transform={`translate(${n.x}, ${n.y})`}
            onClick={() => setSelectedId(n.id)}
          >
            <circle r={n.type === "idea" ? 22 : 14} fill={TYPE_COLORS[n.type] ?? "var(--muted)"} />
            <text className="graph-node-label" y={-22} textAnchor="middle">
              {n.label}
            </text>
          </g>
        ))}
      </svg>
      <aside className="graph-detail" data-testid="concept-detail">
        <span className="graph-detail-type">{selected.type}</span>
        <h3>{selected.label}</h3>
        {selected.detail && <p>{selected.detail}</p>}
        <EvidenceChips evidence={selected.evidence} />
      </aside>
    </div>
  );
}
```

- [ ] **Step 4: Append graph styles to the stylesheet**

Append to `packages/dashboard/src/index.css`:

```css
.graphs { margin-top: 32px; }
.graph-tabs { display: flex; gap: 8px; margin-bottom: 14px; }
.graph-tabs button {
  background: var(--panel); color: var(--muted); border: 1px solid var(--border);
  border-radius: 8px; padding: 6px 14px; font-size: 14px; cursor: pointer;
}
.graph-tabs button.active { color: var(--text); border-color: var(--accent); }

.graph-view {
  display: grid; grid-template-columns: 1fr 280px; gap: 16px;
  background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 12px;
}
.graph-svg { width: 100%; height: auto; background: #0c0e12; border-radius: 8px; }
.graph-edge { stroke: var(--border); stroke-width: 1.5; }
.graph-node { cursor: pointer; }
.graph-node circle { stroke: #0c0e12; stroke-width: 2; transition: r 0.1s; }
.graph-node.selected circle { stroke: var(--text); stroke-width: 3; }
.graph-node-label { fill: var(--muted); font-size: 11px; pointer-events: none; }

.graph-detail { border-left: 1px solid var(--border); padding-left: 14px; }
.graph-detail-type { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.graph-detail h3 { margin: 4px 0 8px; font-size: 17px; }
.graph-detail p { margin: 0 0 10px; font-size: 14px; line-height: 1.5; color: var(--text); }
.graph-detail .differentiator { color: var(--muted); }
.graph-detail-meta { list-style: none; display: flex; gap: 10px; padding: 0; margin: 0 0 10px; color: var(--muted); font-size: 13px; }
.graph-detail-link { display: inline-block; margin-top: 8px; color: var(--accent); text-decoration: none; }
.graph-detail-link:hover { text-decoration: underline; }

.graph-legend { list-style: none; display: flex; flex-wrap: wrap; gap: 12px; padding: 10px 2px 0; margin: 0; grid-column: 1 / -1; }
.graph-legend li { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--muted); }
.legend-swatch { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test --workspace @grasp/dashboard && npm run typecheck --workspace @grasp/dashboard`
Expected: all pass (prior + 3 new ConceptGraph tests); typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add packages/dashboard/src/components/ConceptGraph.tsx packages/dashboard/src/components/ConceptGraph.test.tsx packages/dashboard/src/index.css
git commit -m "feat(dashboard): add ConceptGraph SVG component and graph styles"
```

---

## Task 4: LandscapeGraph component

SVG landscape; clicking a node selects it; the detail panel shows label, one-liner, differentiator, stars/similarity meta, evidence chips, and a "View on GitHub" link for alternatives. A category legend renders below. Default selection is the self node.

**Files:**
- Create: `packages/dashboard/src/components/LandscapeGraph.tsx`
- Test: `packages/dashboard/src/components/LandscapeGraph.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `packages/dashboard/src/components/LandscapeGraph.test.tsx`:

```tsx
import { render, screen, fireEvent, within } from "@testing-library/react";
import { LandscapeGraph } from "./LandscapeGraph";
import { sampleDoc } from "../test-utils/sample";

describe("LandscapeGraph", () => {
  it("renders a node for self and each alternative (not category)", () => {
    render(<LandscapeGraph doc={sampleDoc} />);
    expect(screen.getByTestId("landscape-node-self1")).toBeInTheDocument();
    expect(screen.getByTestId("landscape-node-alt1")).toBeInTheDocument();
    expect(screen.getByTestId("landscape-node-alt2")).toBeInTheDocument();
    expect(screen.queryByTestId("landscape-node-cat1")).toBeNull();
  });

  it("renders the category legend", () => {
    render(<LandscapeGraph doc={sampleDoc} />);
    const legend = screen.getByTestId("landscape-legend");
    expect(within(legend).getByText("Code comprehension tools")).toBeInTheDocument();
  });

  it("defaults the detail panel to the self node (no GitHub link)", () => {
    render(<LandscapeGraph doc={sampleDoc} />);
    const detail = screen.getByTestId("landscape-detail");
    expect(within(detail).getByRole("heading")).toHaveTextContent("Understand-Anything");
    expect(within(detail).queryByRole("link")).toBeNull();
  });

  it("selecting an alternative shows its differentiator and a GitHub link", () => {
    render(<LandscapeGraph doc={sampleDoc} />);
    fireEvent.click(screen.getByTestId("landscape-node-alt1"));
    const detail = screen.getByTestId("landscape-detail");
    expect(within(detail).getByRole("heading")).toHaveTextContent("Sourcegraph Cody");
    expect(within(detail).getByText(/Commercial, IDE-embedded/)).toBeInTheDocument();
    const link = within(detail).getByRole("link", { name: /View on GitHub/ });
    expect(link).toHaveAttribute("href", "https://github.com/sourcegraph/cody");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test --workspace @grasp/dashboard`
Expected: FAIL — cannot resolve `./LandscapeGraph`.

- [ ] **Step 3: Implement the component**

Create `packages/dashboard/src/components/LandscapeGraph.tsx`:

```tsx
import { useState } from "react";
import type { BriefDoc } from "@grasp/schema";
import { layoutLandscape } from "../adapters/landscape";
import { EvidenceChips } from "./EvidenceChips";

export function LandscapeGraph({ doc }: { doc: BriefDoc }) {
  const layout = layoutLandscape(doc);
  const self = layout.nodes.find((n) => n.kind === "self")!;
  const [selectedId, setSelectedId] = useState<string>(self.id);
  const selected = layout.nodes.find((n) => n.id === selectedId) ?? self;
  const byId = new Map(layout.nodes.map((n) => [n.id, n]));

  return (
    <div className="graph-view" data-testid="landscape-graph">
      <svg
        className="graph-svg"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="img"
        aria-label="Competitive landscape"
      >
        {layout.edges.map((e) => {
          const s = byId.get(e.source);
          const t = byId.get(e.target);
          if (!s || !t) return null;
          return <line key={e.id} className="graph-edge" x1={s.x} y1={s.y} x2={t.x} y2={t.y} />;
        })}
        {layout.nodes.map((n) => (
          <g
            key={n.id}
            data-testid={`landscape-node-${n.id}`}
            className={`graph-node${n.id === selectedId ? " selected" : ""}`}
            transform={`translate(${n.x}, ${n.y})`}
            onClick={() => setSelectedId(n.id)}
          >
            <circle r={n.kind === "self" ? 22 : 14} fill={n.color} />
            <text className="graph-node-label" y={-22} textAnchor="middle">
              {n.label}
            </text>
          </g>
        ))}
      </svg>
      <aside className="graph-detail" data-testid="landscape-detail">
        <h3>{selected.label}</h3>
        {selected.oneLiner && <p>{selected.oneLiner}</p>}
        {selected.differentiator && (
          <p className="differentiator">
            <strong>Differs:</strong> {selected.differentiator}
          </p>
        )}
        <ul className="graph-detail-meta">
          {selected.stars !== undefined && <li>★ {selected.stars.toLocaleString("en-US")}</li>}
          {selected.similarity !== undefined && <li>similarity {Math.round(selected.similarity * 100)}%</li>}
        </ul>
        <EvidenceChips evidence={selected.evidence} />
        {selected.kind === "alternative" && selected.url && (
          <a className="graph-detail-link" href={selected.url} target="_blank" rel="noreferrer">
            View on GitHub →
          </a>
        )}
      </aside>
      {layout.categories.length > 0 && (
        <ul className="graph-legend" data-testid="landscape-legend">
          {layout.categories.map((c) => (
            <li key={c.id}>
              <span className="legend-swatch" style={{ background: c.color }} /> {c.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --workspace @grasp/dashboard && npm run typecheck --workspace @grasp/dashboard`
Expected: all pass (prior + 4 new LandscapeGraph tests); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add packages/dashboard/src/components/LandscapeGraph.tsx packages/dashboard/src/components/LandscapeGraph.test.tsx
git commit -m "feat(dashboard): add LandscapeGraph SVG component with legend and GitHub links"
```

---

## Task 5: Wire graphs into the App with a tab toggle + rebuild

Add a graphs section below the cards with a Concept | Landscape tab toggle. Keep the existing header + cards. Rebuild the vendored `dist/`.

**Files:**
- Modify: `packages/dashboard/src/App.tsx`
- Test: `packages/dashboard/src/App.test.tsx`

- [ ] **Step 1: Add failing tests for the tab behavior**

Append the following `describe` block to `packages/dashboard/src/App.test.tsx` (keep the existing tests; `render`, `screen`, `sampleDoc`, `App` are already imported there — also add `fireEvent` to the existing `@testing-library/react` import line, i.e. it should read `import { render, screen, fireEvent } from "@testing-library/react";`):

```tsx
describe("App graphs", () => {
  it("shows the concept graph by default and switches to the landscape on tab click", () => {
    render(<App doc={sampleDoc} />);
    expect(screen.getByRole("tab", { name: "Concept map" })).toBeInTheDocument();
    expect(screen.getByTestId("concept-graph")).toBeInTheDocument();
    expect(screen.queryByTestId("landscape-graph")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Landscape" }));
    expect(screen.getByTestId("landscape-graph")).toBeInTheDocument();
    expect(screen.queryByTestId("concept-graph")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm test --workspace @grasp/dashboard`
Expected: FAIL — no tab/graph elements yet (the existing App tests still pass).

- [ ] **Step 3: Update the App to add the graphs section**

Replace the ENTIRE contents of `packages/dashboard/src/App.tsx`:

```tsx
import { useState } from "react";
import type { BriefDoc } from "@grasp/schema";
import { buildCards, buildSignals } from "./adapters/brief";
import { Header } from "./components/Header";
import { BriefCard } from "./components/BriefCard";
import { ConceptGraph } from "./components/ConceptGraph";
import { LandscapeGraph } from "./components/LandscapeGraph";

type GraphTab = "concept" | "landscape";

export function App({ doc }: { doc: BriefDoc }) {
  const signals = buildSignals(doc);
  const cards = buildCards(doc);
  const [tab, setTab] = useState<GraphTab>("concept");

  return (
    <main className="app">
      <Header signals={signals} />
      <section className="cards-grid">
        {cards.map((card) => (
          <BriefCard key={card.key} card={card} />
        ))}
      </section>
      <section className="graphs">
        <div className="graph-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "concept"}
            className={tab === "concept" ? "active" : ""}
            onClick={() => setTab("concept")}
          >
            Concept map
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "landscape"}
            className={tab === "landscape" ? "active" : ""}
            onClick={() => setTab("landscape")}
          >
            Landscape
          </button>
        </div>
        {tab === "concept" ? <ConceptGraph doc={doc} /> : <LandscapeGraph doc={doc} />}
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npm test --workspace @grasp/dashboard && npm run typecheck --workspace @grasp/dashboard`
Expected: all pass (existing App tests + the new tab test + all adapter/component tests); typecheck clean.

- [ ] **Step 5: Rebuild the vendored dist**

Run: `npm run build --workspace @grasp/dashboard`
Expected: build succeeds; `dist/` is regenerated with the graphs included; `dist/repo-brief.json` present.

- [ ] **Step 6: Verify the build is still self-contained**

Run: `test -f packages/dashboard/dist/repo-brief.json && grep -q "./assets/" packages/dashboard/dist/index.html && echo "OK: self-contained build with graphs"`
Expected: prints `OK: self-contained build with graphs`.

- [ ] **Step 7: Confirm dist/ is still untracked, then commit source only**

Run: `git status --porcelain packages/dashboard/dist` — expect empty (still gitignored).

```bash
git add packages/dashboard/src/App.tsx packages/dashboard/src/App.test.tsx
git commit -m "feat(dashboard): wire concept + landscape graphs into the App with tabs"
```

---

## Definition of Done

- `npm test --workspace @grasp/dashboard` passes: prior 13 + concept adapter (4) + landscape adapter (5) + ConceptGraph (3) + LandscapeGraph (4) + App tab (1) = 30 tests.
- `npm run typecheck --workspace @grasp/dashboard` is clean.
- `npm run build --workspace @grasp/dashboard` emits a self-contained `dist/` (relative assets + bundled `repo-brief.json`) that now includes both graphs.
- The dashboard renders, below the prose cards, a Concept | Landscape tab toggle; the concept map centers the idea with typed-color nodes; the landscape centers the analyzed repo with alternatives placed by similarity, a category legend, and per-alternative GitHub links; clicking any node updates a detail panel with evidence chips.
- No new runtime dependencies; both layouts are pure, deterministic functions.

**Out of scope (future):** pan/zoom, edge labels, spatial category clustering, richer force layouts, the agent pipeline that generates real briefs (Plan 3), incremental re-analysis (Plan 4).
