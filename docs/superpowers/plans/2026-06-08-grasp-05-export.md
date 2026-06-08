# `/grasp` Export (Markdown + print-HTML→PDF) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a validated `repo-brief.json` into two portable artifacts — a Markdown document (prose + evidence footnotes + Mermaid graphs) and a self-contained print-ready HTML page (prose + evidence + inline static SVG graphs) — via a `grasp-export` CLI.

**Architecture:** A new `packages/export` workspace holds two **pure, deterministic** exporters over `BriefDoc` plus a thin CLI. Markdown renders the two graphs as **Mermaid** (which self-lays-out, so no coordinates needed). The print-HTML renders them as **inline static SVG**, reusing the dashboard's existing pure layout adapters (`layoutConcept`/`layoutLandscape`) via a new additive `@grasp/dashboard/adapters` export subpath (pulls in no React). Nothing about brief *production* changes — export is a presentation layer downstream of a finished brief, reading only a validated `BriefDoc`.

**Tech Stack:** TypeScript (no build; `tsx`), Vitest, Node `fs`. Reuses `@grasp/schema` (`validateBrief`, types) and `@grasp/dashboard` (layout adapters). npm workspaces.

---

## Design decisions resolved in this plan

1. **Markdown graphs = Mermaid; print-HTML graphs = inline static SVG.** Two representations by design (brainstorming): Mermaid is text-portable (GitHub/VS Code render it); static SVG prints to PDF flawlessly with no JS. They are separate builders (`mermaid.ts`, `svg.ts`).
2. **The print SVG reuses the dashboard's layout adapters** so the printed graph matches the on-screen graph and the radial-layout math has one home. The reuse is via a new `@grasp/dashboard/adapters` package export; the adapter modules import only `@grasp/schema` types, so no React is pulled into `@grasp/export`.
3. **Mermaid edges are labelled by relation type only** (e.g. `-->|addresses|`). Similarity is a *node* attribute, so forcing it onto edges is ambiguous (an alt→alt edge has two similarities); it is omitted from Mermaid for clarity. (The print-HTML can still show it; not required here.)
4. **"Self-contained" print-HTML** means no loaded external assets: no `<script>`, no `src=`, no `<link rel=stylesheet>`, no `@import`. Ordinary hyperlinks (`<a href="https://…">` to the repo / evidence sources) ARE allowed and desirable — they load nothing and print fine.
5. **Markdown body carries no timestamps**, so the same brief always yields identical Markdown (golden-testable).

---

## File structure

```
packages/export/                  # NEW workspace
├── package.json                  # bin: grasp-export; deps @grasp/schema, @grasp/dashboard
├── tsconfig.json
├── vitest.config.ts
└── src/
    ├── index.ts                   # public exports (built up across tasks)
    ├── mermaid.ts                 # conceptToMermaid / landscapeToMermaid
    ├── markdown.ts                # briefToMarkdown
    ├── svg.ts                     # conceptToSvg / landscapeToSvg (reuse layout adapters)
    ├── printHtml.ts               # briefToPrintHtml
    ├── cli-run.ts                 # runExport(argv): number
    ├── cli.ts                     # #!/usr/bin/env tsx bin wrapper
    └── __tests__/
        ├── smoke.test.ts
        ├── mermaid.test.ts
        ├── markdown.test.ts
        ├── svg.test.ts
        ├── printHtml.test.ts
        └── cli.test.ts

packages/dashboard/
├── package.json                   # MODIFY — add "exports": { "./adapters": "./src/adapters/index.ts" }
└── src/adapters/index.ts          # NEW — re-export concept/landscape/brief adapters

skills/grasp/SKILL.md              # MODIFY — add "## Export & share"
packages/pipeline/src/__tests__/skill-contract.test.ts   # MODIFY — assert grasp-export / report.html
```

---

## Task 1: Scaffold `packages/export` + expose the dashboard adapters

**Files:**
- Create: `packages/dashboard/src/adapters/index.ts`
- Modify: `packages/dashboard/package.json` (add `exports`)
- Create: `packages/export/package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts`
- Test: `packages/export/src/__tests__/smoke.test.ts`

- [ ] **Step 1: Re-export the dashboard adapters.** Create `packages/dashboard/src/adapters/index.ts`:

```ts
export * from "./brief";
export * from "./concept";
export * from "./landscape";
```

- [ ] **Step 2: Add the `./adapters` export subpath.** In `packages/dashboard/package.json`, add a top-level `"exports"` field (after the `"private": true,` line):

```json
  "exports": {
    "./adapters": "./src/adapters/index.ts"
  },
```

- [ ] **Step 3: Create the export workspace configs.**

`packages/export/package.json`:

```json
{
  "name": "@grasp/export",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "bin": { "grasp-export": "src/cli.ts" },
  "scripts": {
    "export": "tsx src/cli.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@grasp/schema": "*",
    "@grasp/dashboard": "*"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.1.0"
  }
}
```

`packages/export/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["node"],
    "strict": true,
    "noEmit": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
```

`packages/export/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
```

`packages/export/src/index.ts`:

```ts
export const EXPORT_VERSION = "0.1.0";
```

- [ ] **Step 4: Write the smoke test** at `packages/export/src/__tests__/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { EXPORT_VERSION } from "../index";
import { validateBrief } from "@grasp/schema";
import sample from "@grasp/schema/sample-brief.json";
import { layoutConcept } from "@grasp/dashboard/adapters";

describe("export package wiring", () => {
  it("exposes its version", () => {
    expect(EXPORT_VERSION).toBe("0.1.0");
  });

  it("can reuse the dashboard layout adapter (no React pulled in)", () => {
    const doc = validateBrief(sample).data!;
    const layout = layoutConcept(doc);
    expect(layout.nodes.length).toBeGreaterThan(0);
    expect(Number.isFinite(layout.nodes[0].x)).toBe(true);
  });
});
```

- [ ] **Step 5: Install so npm links the new workspace.** Run: `npm install`
  Expected: completes; `@grasp/export` is linked with its `@grasp/dashboard` + `@grasp/schema` deps.

- [ ] **Step 6: Run the smoke test.** `npm test --workspace @grasp/export` → PASS (2 tests).

- [ ] **Step 7: Confirm the dashboard still works** (the additive `exports` field must not break it). Run: `npm test --workspace @grasp/dashboard && npm run typecheck --workspace @grasp/dashboard`
  Expected: 35 tests PASS, typecheck clean.

- [ ] **Step 8: Typecheck the export package.** `npm run typecheck --workspace @grasp/export` → clean.

- [ ] **Step 9: Commit**

```bash
git add packages/export packages/dashboard/package.json packages/dashboard/src/adapters/index.ts package.json package-lock.json
git commit -m "chore(export): scaffold @grasp/export; expose @grasp/dashboard/adapters"
```

---

## Task 2: `mermaid.ts` — graphs as Mermaid

**Files:**
- Create: `packages/export/src/mermaid.ts`
- Modify: `packages/export/src/index.ts`
- Test: `packages/export/src/__tests__/mermaid.test.ts`

- [ ] **Step 1: Write the failing test** at `packages/export/src/__tests__/mermaid.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateBrief } from "@grasp/schema";
import sample from "@grasp/schema/sample-brief.json";
import { conceptToMermaid, landscapeToMermaid } from "../mermaid";

const doc = validateBrief(sample).data!;

describe("conceptToMermaid", () => {
  const out = conceptToMermaid(doc);
  it("starts a top-down flowchart", () => {
    expect(out.startsWith("flowchart TD")).toBe(true);
  });
  it("emits one node line per concept node with a type class", () => {
    for (const n of doc.conceptGraph.nodes) {
      expect(out).toContain(`${n.id}["`);
      expect(out).toContain(`]:::${n.type}`);
    }
  });
  it("emits one edge line per concept edge labelled by relation", () => {
    for (const e of doc.conceptGraph.edges) {
      expect(out).toContain(`${e.source} -->|${e.type}| ${e.target}`);
    }
  });
  it("includes classDef styling for node types", () => {
    expect(out).toContain("classDef idea");
  });
});

describe("landscapeToMermaid", () => {
  const out = landscapeToMermaid(doc);
  it("starts a left-right flowchart and labels nodes by name", () => {
    expect(out.startsWith("flowchart LR")).toBe(true);
    expect(out).toContain('self1["Understand-Anything"]:::self');
  });
  it("emits a click directive for alternatives with a url", () => {
    expect(out).toContain('click alt1 "https://github.com/sourcegraph/cody" _blank');
  });
});

describe("label escaping", () => {
  it("escapes double quotes in labels", () => {
    const d = JSON.parse(JSON.stringify(sample));
    d.conceptGraph.nodes[0].label = 'a "quoted" label';
    const out = conceptToMermaid(validateBrief(d).data!);
    expect(out).toContain("&quot;quoted&quot;");
    expect(out).not.toContain('"quoted"');
  });
});
```

- [ ] **Step 2: Run to verify it fails** ("Cannot find module '../mermaid'"): `npm test --workspace @grasp/export`

- [ ] **Step 3: Implement `mermaid.ts`**

`packages/export/src/mermaid.ts`:

```ts
import type { BriefDoc } from "@grasp/schema";

const CONCEPT_CLASSDEF = [
  "classDef idea fill:#f5c451,stroke:#caa23c,color:#1a1a1a;",
  "classDef problem fill:#e5687a,stroke:#c14f60,color:#1a1a1a;",
  "classDef mechanism fill:#5aa9f0,stroke:#3f86c9,color:#1a1a1a;",
  "classDef outcome fill:#5bd1a0,stroke:#3fad82,color:#1a1a1a;",
  "classDef feature fill:#b794f6,stroke:#9670d8,color:#1a1a1a;",
];

const LANDSCAPE_CLASSDEF = [
  "classDef self fill:#f5c451,stroke:#caa23c,color:#1a1a1a;",
  "classDef alternative fill:#5aa9f0,stroke:#3f86c9,color:#1a1a1a;",
  "classDef category fill:#d8dee9,stroke:#aab4c4,color:#1a1a1a;",
];

/** Mermaid labels are wrapped in double quotes, so quotes inside become entities and newlines collapse. */
function label(text: string): string {
  return text.replace(/"/g, "&quot;").replace(/\s+/g, " ").trim();
}

export function conceptToMermaid(doc: BriefDoc): string {
  const lines = ["flowchart TD"];
  for (const n of doc.conceptGraph.nodes) {
    lines.push(`  ${n.id}["${label(n.label)}"]:::${n.type}`);
  }
  for (const e of doc.conceptGraph.edges) {
    lines.push(`  ${e.source} -->|${e.type}| ${e.target}`);
  }
  for (const c of CONCEPT_CLASSDEF) lines.push(`  ${c}`);
  return lines.join("\n");
}

export function landscapeToMermaid(doc: BriefDoc): string {
  const lines = ["flowchart LR"];
  for (const n of doc.landscapeGraph.nodes) {
    const text = n.name ?? n.label ?? n.id;
    lines.push(`  ${n.id}["${label(text)}"]:::${n.type}`);
  }
  for (const e of doc.landscapeGraph.edges) {
    lines.push(`  ${e.source} -->|${e.type}| ${e.target}`);
  }
  for (const n of doc.landscapeGraph.nodes) {
    if (n.type === "alternative" && n.url) {
      lines.push(`  click ${n.id} "${n.url}" _blank`);
    }
  }
  for (const c of LANDSCAPE_CLASSDEF) lines.push(`  ${c}`);
  return lines.join("\n");
}
```

- [ ] **Step 4: Export from the index.** Add to `packages/export/src/index.ts`:

```ts
export * from "./mermaid";
```

- [ ] **Step 5: Run the tests** → PASS.
- [ ] **Step 6: Typecheck** → clean.
- [ ] **Step 7: Commit**

```bash
git add packages/export/src/mermaid.ts packages/export/src/index.ts packages/export/src/__tests__/mermaid.test.ts
git commit -m "feat(export): concept + landscape graphs as Mermaid"
```

---

## Task 3: `markdown.ts` — the Markdown document

**Files:**
- Create: `packages/export/src/markdown.ts`
- Modify: `packages/export/src/index.ts`
- Test: `packages/export/src/__tests__/markdown.test.ts`

- [ ] **Step 1: Write the failing test** at `packages/export/src/__tests__/markdown.test.ts`:

````ts
import { describe, it, expect } from "vitest";
import { validateBrief } from "@grasp/schema";
import sample from "@grasp/schema/sample-brief.json";
import { briefToMarkdown } from "../markdown";

const doc = validateBrief(sample).data!;
const md = briefToMarkdown(doc);

describe("briefToMarkdown", () => {
  it("titles with the repo and the takeaway verdict", () => {
    expect(md).toContain(`# ${doc.meta.repo}`);
    expect(md).toContain(`> ${doc.brief.takeaway}`);
  });

  it("includes all five answer sections", () => {
    for (const heading of ["## Idea", "## Problem", "## Why it wins", "## How", "## Takeaway"]) {
      expect(md).toContain(heading);
    }
  });

  it("renders both graphs as mermaid blocks", () => {
    expect(md).toContain("## Concept map");
    expect(md).toContain("## Competitive landscape");
    expect((md.match(/```mermaid/g) ?? []).length).toBe(2);
  });

  it("footnotes cited evidence with a verified/inferred tag", () => {
    // sample-brief cites ev1 on `why`
    expect(md).toContain("[^ev1]");
    expect(md).toMatch(/\[\^ev1\]:.*\(verified\)/);
  });

  it("is deterministic (same brief → identical markdown)", () => {
    expect(briefToMarkdown(doc)).toBe(md);
  });
});
````

- [ ] **Step 2: Run to verify it fails** ("Cannot find module '../markdown'"): `npm test --workspace @grasp/export`

- [ ] **Step 3: Implement `markdown.ts`**

````ts
import type { BriefDoc } from "@grasp/schema";
import { conceptToMermaid, landscapeToMermaid } from "./mermaid";

const SECTIONS: { key: "idea" | "problem" | "why" | "how" | "takeaway"; title: string }[] = [
  { key: "idea", title: "Idea" },
  { key: "problem", title: "Problem" },
  { key: "why", title: "Why it wins" },
  { key: "how", title: "How" },
  { key: "takeaway", title: "Takeaway" },
];

export function briefToMarkdown(doc: BriefDoc): string {
  const out: string[] = [`# ${doc.meta.repo}`, "", `> ${doc.brief.takeaway}`, ""];

  const signals: string[] = [];
  if (doc.meta.signals.stars !== undefined) signals.push(`${doc.meta.signals.stars}★`);
  if (doc.meta.signals.language) signals.push(doc.meta.signals.language);
  signals.push(`${doc.meta.depth} × ${doc.meta.broadness}`);
  out.push(`\`${signals.join(" · ")}\``, "");

  const evidenceMap = doc.brief.evidence ?? {};
  const cited: string[] = [];

  for (const { key, title } of SECTIONS) {
    const ids = evidenceMap[key] ?? [];
    for (const id of ids) if (!cited.includes(id)) cited.push(id);
    const markers = ids.map((id) => `[^${id}]`).join("");
    out.push(`## ${title}`, `${doc.brief[key]}${markers ? ` ${markers}` : ""}`, "");
  }

  out.push("## Concept map", "", "```mermaid", conceptToMermaid(doc), "```", "");
  out.push("## Competitive landscape", "", "```mermaid", landscapeToMermaid(doc), "```", "");

  if (cited.length > 0) {
    const byId = new Map(doc.evidence.map((e) => [e.id, e]));
    out.push("");
    for (const id of cited) {
      const e = byId.get(id);
      if (!e) continue;
      const src = e.url ? `[${e.source}](${e.url})` : e.source;
      out.push(`[^${id}]: ${e.claim} — ${src} (${e.verified ? "verified" : "inferred"})`);
    }
  }

  return `${out.join("\n")}\n`;
}
````

- [ ] **Step 4: Export from the index.** Add to `packages/export/src/index.ts`:

```ts
export * from "./markdown";
```

- [ ] **Step 5: Run the tests** → PASS.
- [ ] **Step 6: Typecheck** → clean.
- [ ] **Step 7: Commit**

```bash
git add packages/export/src/markdown.ts packages/export/src/index.ts packages/export/src/__tests__/markdown.test.ts
git commit -m "feat(export): briefToMarkdown (prose + evidence footnotes + mermaid graphs)"
```

---

## Task 4: `svg.ts` — graphs as inline static SVG (reusing the layout)

**Files:**
- Create: `packages/export/src/svg.ts`
- Modify: `packages/export/src/index.ts`
- Test: `packages/export/src/__tests__/svg.test.ts`

- [ ] **Step 1: Write the failing test** at `packages/export/src/__tests__/svg.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateBrief } from "@grasp/schema";
import sample from "@grasp/schema/sample-brief.json";
import { conceptToSvg, landscapeToSvg } from "../svg";

const doc = validateBrief(sample).data!;

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("conceptToSvg", () => {
  const svg = conceptToSvg(doc);
  it("is an <svg> with a viewBox", () => {
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("viewBox=");
  });
  it("renders one node group per concept node and one line per edge", () => {
    expect(count(svg, "<g ")).toBe(doc.conceptGraph.nodes.length);
    expect(count(svg, "<line ")).toBe(doc.conceptGraph.edges.length);
  });
  it("is deterministic", () => {
    expect(conceptToSvg(doc)).toBe(svg);
  });
});

describe("landscapeToSvg", () => {
  const svg = landscapeToSvg(doc);
  it("renders the physical nodes (self + alternatives, not category) and the edges", () => {
    // layoutLandscape places self + alternatives; categories go to a legend, not nodes
    const physical = doc.landscapeGraph.nodes.filter((n) => n.type !== "category").length;
    expect(count(svg, "<g ")).toBe(physical);
  });
  it("escapes special characters in labels", () => {
    const d = JSON.parse(JSON.stringify(sample));
    d.landscapeGraph.nodes[1].name = "A & B <co>";
    const out = landscapeToSvg(validateBrief(d).data!);
    expect(out).toContain("A &amp; B &lt;co&gt;");
  });
});
```

- [ ] **Step 2: Run to verify it fails** ("Cannot find module '../svg'"): `npm test --workspace @grasp/export`

- [ ] **Step 3: Implement `svg.ts`**

```ts
import type { BriefDoc } from "@grasp/schema";
import { layoutConcept, layoutLandscape } from "@grasp/dashboard/adapters";

const CONCEPT_FILL: Record<string, string> = {
  idea: "#f5c451",
  problem: "#e5687a",
  mechanism: "#5aa9f0",
  outcome: "#5bd1a0",
  feature: "#b794f6",
};
const DEFAULT_FILL = "#9aa3b2";

function xml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface RenderNode {
  id: string;
  x: number;
  y: number;
  label: string;
  fill: string;
}

function renderSvg(
  cls: string,
  width: number,
  height: number,
  nodes: RenderNode[],
  edges: { source: string; target: string }[],
): string {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const parts = [
    `<svg class="graph ${cls}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`,
  ];
  for (const e of edges) {
    const s = byId.get(e.source);
    const t = byId.get(e.target);
    if (!s || !t) continue;
    parts.push(`<line class="edge" x1="${s.x}" y1="${s.y}" x2="${t.x}" y2="${t.y}"/>`);
  }
  for (const n of nodes) {
    parts.push(
      `<g transform="translate(${n.x}, ${n.y})"><circle r="14" fill="${n.fill}"/>` +
        `<text y="-20" text-anchor="middle">${xml(n.label)}</text></g>`,
    );
  }
  parts.push("</svg>");
  return parts.join("");
}

export function conceptToSvg(doc: BriefDoc): string {
  const layout = layoutConcept(doc);
  const nodes: RenderNode[] = layout.nodes.map((n) => ({
    id: n.id,
    x: n.x,
    y: n.y,
    label: n.label,
    fill: CONCEPT_FILL[n.type] ?? DEFAULT_FILL,
  }));
  return renderSvg("concept", layout.width, layout.height, nodes, layout.edges);
}

export function landscapeToSvg(doc: BriefDoc): string {
  const layout = layoutLandscape(doc);
  const nodes: RenderNode[] = layout.nodes.map((n) => ({
    id: n.id,
    x: n.x,
    y: n.y,
    label: n.label,
    fill: n.color,
  }));
  return renderSvg("landscape", layout.width, layout.height, nodes, layout.edges);
}
```

- [ ] **Step 4: Export from the index.** Add to `packages/export/src/index.ts`:

```ts
export * from "./svg";
```

- [ ] **Step 5: Run the tests** → PASS.
- [ ] **Step 6: Typecheck** → clean.
- [ ] **Step 7: Commit**

```bash
git add packages/export/src/svg.ts packages/export/src/index.ts packages/export/src/__tests__/svg.test.ts
git commit -m "feat(export): concept + landscape graphs as inline static SVG (reusing layout)"
```

---

## Task 5: `printHtml.ts` — the self-contained print page

**Files:**
- Create: `packages/export/src/printHtml.ts`
- Modify: `packages/export/src/index.ts`
- Test: `packages/export/src/__tests__/printHtml.test.ts`

- [ ] **Step 1: Write the failing test** at `packages/export/src/__tests__/printHtml.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateBrief } from "@grasp/schema";
import sample from "@grasp/schema/sample-brief.json";
import { briefToPrintHtml } from "../printHtml";

const doc = validateBrief(sample).data!;
const html = briefToPrintHtml(doc);

describe("briefToPrintHtml", () => {
  it("is a complete HTML document", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("</html>");
  });

  it("contains all five prose answers", () => {
    for (const key of ["idea", "problem", "why", "how", "takeaway"] as const) {
      expect(html).toContain(doc.brief[key]);
    }
  });

  it("embeds both graphs as inline svg", () => {
    expect((html.match(/<svg /g) ?? []).length).toBe(2);
  });

  it("has a print stylesheet and a references section", () => {
    expect(html).toContain("@media print");
    expect(html).toContain("@page");
    expect(html).toContain("References");
  });

  it("is self-contained (no loaded external assets)", () => {
    expect(html).not.toContain("<script");
    expect(html).not.toContain(" src=");
    expect(html).not.toContain("<link ");
    expect(html).not.toContain("@import");
  });

  it("marks inferred evidence distinctly", () => {
    const d = JSON.parse(JSON.stringify(sample));
    d.evidence[0].verified = false;
    const out = briefToPrintHtml(validateBrief(d).data!);
    expect(out).toContain("inferred");
  });
});
```

- [ ] **Step 2: Run to verify it fails** ("Cannot find module '../printHtml'"): `npm test --workspace @grasp/export`

- [ ] **Step 3: Implement `printHtml.ts`**

```ts
import type { BriefDoc } from "@grasp/schema";
import { conceptToSvg, landscapeToSvg } from "./svg";

const SECTIONS: { key: "idea" | "problem" | "why" | "how" | "takeaway"; title: string }[] = [
  { key: "idea", title: "Idea" },
  { key: "problem", title: "Problem" },
  { key: "why", title: "Why it wins" },
  { key: "how", title: "How" },
  { key: "takeaway", title: "Takeaway" },
];

const STYLE = `
* { box-sizing: border-box; }
body { font: 15px/1.55 -apple-system, system-ui, "Segoe UI", sans-serif; color: #1a1a1a; max-width: 820px; margin: 0 auto; padding: 32px; }
h1 { margin: 0 0 4px; font-size: 26px; }
h1 a { color: inherit; text-decoration: none; }
.verdict { color: #555; font-size: 18px; margin: 0 0 12px; }
.chips { color: #777; font-size: 13px; margin: 0 0 24px; }
section { margin: 16px 0; page-break-inside: avoid; }
h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .07em; color: #777; margin: 0 0 4px; }
section p { margin: 0; }
sup { color: #b36; font-size: 11px; }
.graph { width: 100%; height: auto; border: 1px solid #e2e2e2; border-radius: 8px; background: #fff; }
.graph .edge { stroke: #c2c2c2; stroke-width: 1.5; }
.graph circle { stroke: #fff; stroke-width: 2; }
.graph text { fill: #1a1a1a; font-size: 11px; }
.refs { font-size: 13px; color: #555; border-top: 1px solid #e2e2e2; margin-top: 24px; padding-top: 12px; }
.refs .inferred { color: #b8860b; font-weight: 600; }
@page { margin: 18mm; }
@media print { body { padding: 0; max-width: none; } section, .graph { break-inside: avoid; } }
`;

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function briefToPrintHtml(doc: BriefDoc): string {
  const evidenceMap = doc.brief.evidence ?? {};
  const byId = new Map(doc.evidence.map((e) => [e.id, e]));
  const refs: string[] = [];
  const refNum = (id: string): number => {
    if (!refs.includes(id)) refs.push(id);
    return refs.indexOf(id) + 1;
  };

  const sectionsHtml = SECTIONS.map(({ key, title }) => {
    const sups = (evidenceMap[key] ?? [])
      .map((id) => `<sup>[${refNum(id)}]</sup>`)
      .join("");
    return `<section><h2>${title}</h2><p>${esc(doc.brief[key])}${sups}</p></section>`;
  }).join("");

  const chips: string[] = [];
  if (doc.meta.signals.stars !== undefined) chips.push(`${doc.meta.signals.stars}★`);
  if (doc.meta.signals.language) chips.push(esc(doc.meta.signals.language));
  chips.push(`${doc.meta.depth} × ${doc.meta.broadness}`);

  const refsHtml =
    refs.length > 0
      ? `<div class="refs"><strong>References</strong><ol>${refs
          .map((id) => {
            const e = byId.get(id)!;
            const src = e.url ? `<a href="${esc(e.url)}">${esc(e.source)}</a>` : esc(e.source);
            const tag = e.verified ? "verified" : `<span class="inferred">inferred</span>`;
            return `<li>${esc(e.claim)} — ${src} (${tag})</li>`;
          })
          .join("")}</ol></div>`
      : "";

  const title = doc.meta.url
    ? `<a href="${esc(doc.meta.url)}">${esc(doc.meta.repo)}</a>`
    : esc(doc.meta.repo);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(doc.meta.repo)} — grasp brief</title><style>${STYLE}</style></head>
<body>
<h1>${title}</h1>
<p class="verdict">${esc(doc.brief.takeaway)}</p>
<p class="chips">${chips.join(" · ")}</p>
${sectionsHtml}
<section><h2>Concept map</h2>${conceptToSvg(doc)}</section>
<section><h2>Competitive landscape</h2>${landscapeToSvg(doc)}</section>
${refsHtml}
</body></html>
`;
}
```

- [ ] **Step 4: Export from the index.** Add to `packages/export/src/index.ts`:

```ts
export * from "./printHtml";
```

- [ ] **Step 5: Run the tests** → PASS.
- [ ] **Step 6: Typecheck** → clean.
- [ ] **Step 7: Commit**

```bash
git add packages/export/src/printHtml.ts packages/export/src/index.ts packages/export/src/__tests__/printHtml.test.ts
git commit -m "feat(export): briefToPrintHtml (self-contained print page, inline svg)"
```

---

## Task 6: `grasp-export` CLI

**Files:**
- Create: `packages/export/src/cli-run.ts`
- Create: `packages/export/src/cli.ts`
- Test: `packages/export/src/__tests__/cli.test.ts`

- [ ] **Step 1: Write the failing test** at `packages/export/src/__tests__/cli.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sample from "@grasp/schema/sample-brief.json";
import { runExport } from "../cli-run";

let work: string;
let briefPath: string;
let outDir: string;

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), "grasp-export-"));
  briefPath = join(work, "repo-brief.json");
  outDir = join(work, "out");
  writeFileSync(briefPath, JSON.stringify(sample));
  mkdirSync(outDir, { recursive: true });
});
afterEach(() => {
  rmSync(work, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("runExport", () => {
  it("writes both report.md and report.html by default", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const code = runExport([briefPath, "--out", outDir]);
    expect(code).toBe(0);
    expect(readFileSync(join(outDir, "report.md"), "utf8").length).toBeGreaterThan(0);
    expect(readFileSync(join(outDir, "report.html"), "utf8")).toContain("<svg ");
  });

  it("--format md writes only the markdown", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const code = runExport([briefPath, "--out", outDir, "--format", "md"]);
    expect(code).toBe(0);
    expect(existsSync(join(outDir, "report.md"))).toBe(true);
    expect(existsSync(join(outDir, "report.html"))).toBe(false);
  });

  it("exits 1 on an invalid brief", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const bad = join(work, "bad.json");
    writeFileSync(bad, JSON.stringify({ meta: {} }));
    expect(runExport([bad, "--out", outDir])).toBe(1);
  });

  it("exits 2 on missing brief argument", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(runExport(["--out", outDir])).toBe(2);
  });

  it("exits 2 on an unknown --format", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(runExport([briefPath, "--out", outDir, "--format", "pdf"])).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify it fails** ("Cannot find module '../cli-run'"): `npm test --workspace @grasp/export`

- [ ] **Step 3: Implement `cli-run.ts`**

```ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { validateBrief } from "@grasp/schema";
import { briefToMarkdown } from "./markdown";
import { briefToPrintHtml } from "./printHtml";

interface Args {
  briefPath?: string;
  format?: string;
  out?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--format") args.format = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else positional.push(a);
  }
  if (positional.length > 0) args.briefPath = positional[0];
  return args;
}

/** Exit code: 0 ok, 1 invalid brief, 2 usage/IO error. */
export function runExport(argv: string[]): number {
  const { briefPath, format = "both", out } = parseArgs(argv);
  if (!briefPath) {
    console.error("usage: grasp-export <brief.json> [--format md|html|both] [--out <dir>]");
    return 2;
  }
  if (!["md", "html", "both"].includes(format)) {
    console.error(`unknown --format '${format}' (use md|html|both)`);
    return 2;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(briefPath, "utf8"));
  } catch (err) {
    console.error(`Cannot read ${briefPath}: ${(err as Error).message}`);
    return 2;
  }

  const { ok, errors, data } = validateBrief(raw);
  if (!ok || !data) {
    console.error(`✗ ${briefPath} is not a valid repo-brief:`);
    for (const e of errors) console.error(`  - ${e}`);
    return 1;
  }

  const outDir = out ?? dirname(resolve(briefPath));
  try {
    mkdirSync(outDir, { recursive: true });
    const written: string[] = [];
    if (format === "md" || format === "both") {
      const p = join(outDir, "report.md");
      writeFileSync(p, briefToMarkdown(data), "utf8");
      written.push(p);
    }
    if (format === "html" || format === "both") {
      const p = join(outDir, "report.html");
      writeFileSync(p, briefToPrintHtml(data), "utf8");
      written.push(p);
    }
    for (const p of written) console.log(p);
    return 0;
  } catch (err) {
    console.error(`Cannot write to ${outDir}: ${(err as Error).message}`);
    return 2;
  }
}
```

- [ ] **Step 4: Implement the bin wrapper** at `packages/export/src/cli.ts`:

```ts
#!/usr/bin/env tsx
import { runExport } from "./cli-run";

process.exit(runExport(process.argv.slice(2)));
```

- [ ] **Step 5: Run the tests** → PASS.

- [ ] **Step 6: Smoke-run the CLI by hand** to confirm it produces real files:

```bash
npx tsx packages/export/src/cli.ts packages/schema/sample-brief.json --out /tmp/grasp-export-smoke
ls /tmp/grasp-export-smoke   # expect report.md and report.html
rm -rf /tmp/grasp-export-smoke
```

- [ ] **Step 7: Typecheck** → clean.
- [ ] **Step 8: Commit**

```bash
git add packages/export/src/cli-run.ts packages/export/src/cli.ts packages/export/src/__tests__/cli.test.ts
git commit -m "feat(export): grasp-export CLI (writes report.md / report.html)"
```

---

## Task 7: wire export into `SKILL.md`

**Files:**
- Modify: `skills/grasp/SKILL.md`
- Modify: `packages/pipeline/src/__tests__/skill-contract.test.ts`

- [ ] **Step 1: Extend the drift-guard test.** In `packages/pipeline/src/__tests__/skill-contract.test.ts`, add two tokens to the `for (const token of [ ... ])` array (alongside the existing ones): `"grasp-export"` and `"report.html"`.

- [ ] **Step 2: Run to verify it fails** (SKILL.md lacks `grasp-export` / `report.html`): `npm test --workspace @grasp/pipeline`

- [ ] **Step 3: Add the "Export & share" section to `skills/grasp/SKILL.md`,** immediately after the `## Phase 4 — Open the report` section (and before `## Degradation & errors`). Insert (the block contains ```bash fenced code that must be preserved as a real fence):

````markdown
## Export & share

To share the brief outside the dashboard, run the **`grasp-export`** CLI against
the written brief:

```bash
npx tsx packages/export/src/cli.ts <target>/.grasp/dashboard/repo-brief.json \
  --format both --out <target>/.grasp
```

It writes `report.md` (paste-ready for a README or PR — the two graphs render as
Mermaid) and `report.html` (a self-contained print page). For a PDF, open
`report.html` and print to PDF, or — when a headless Chrome is available —

```bash
chrome --headless --print-to-pdf="<target>/.grasp/report.pdf" "<target>/.grasp/report.html"
```
````

- [ ] **Step 4: Run the tests** → PASS (drift-guard finds `grasp-export` and `report.html`).

- [ ] **Step 5: Commit**

```bash
git add skills/grasp/SKILL.md packages/pipeline/src/__tests__/skill-contract.test.ts
git commit -m "feat(skill): document Export & share (grasp-export → md/html, print to PDF)"
```

---

## Final verification (after all tasks)

- [ ] Whole export suite: `npm test --workspace @grasp/export` → all pass.
- [ ] Every workspace: `npm test --workspaces --if-present` → schema, dashboard, pipeline, export all PASS (the dashboard's additive `exports` field must not have regressed it).
- [ ] Typecheck all: `npm run typecheck --workspace @grasp/schema && npm run typecheck --workspace @grasp/dashboard && npm run typecheck --workspace @grasp/pipeline && npm run typecheck --workspace @grasp/export` → no errors.
- [ ] Eyeball a real export: `npx tsx packages/export/src/cli.ts packages/schema/sample-brief.json --out /tmp/grasp-x && open /tmp/grasp-x/report.html` (optional visual check), then `rm -rf /tmp/grasp-x`.
- [ ] `git status` clean (no stray temp files or exec-bit noise).
