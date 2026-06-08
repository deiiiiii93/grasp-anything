# Grasp — Plan 2: Dashboard Brief View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `packages/dashboard` as a React/Vite app that renders a `repo-brief.json` into a strategic brief — a header (repo, takeaway verdict, signal chips) and five evidence-backed prose cards (Idea / Problem / Why It Wins / How It Works / Takeaway) — and first extend the schema contract so prose cards can cite evidence.

**Architecture:** Pure adapter functions turn a validated `BriefDoc` into view models (cards + signals + resolved evidence); dumb presentational React components render them. `main.tsx` fetches `./repo-brief.json`, validates it with `@grasp/schema`'s `validateBrief`, and mounts `<App doc={...} />`. The app is built once at dev time and the compiled `dist/` is vendored (the runtime never builds). The two interactive graphs are a separate follow-on plan (2b).

**Tech Stack:** Node 22+, npm workspaces, React 18, Vite 5, TypeScript (bundler resolution, no-build via Vite), Vitest + jsdom + @testing-library/react, Zod (via `@grasp/schema`).

**This is Plan 2 of the dashboard work.** Plan 2b adds the concept + landscape SVG graphs. Depends on Plan 1 (`@grasp/schema`, already on `main`).

Spec: `docs/superpowers/specs/2026-06-08-grasp-design.md` — §4 (contract), §5 (HTML report), and §11 decision #1 (prose evidence — **resolved: yes, all prose cards can cite evidence**).

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/schema/src/schema.ts` (modify) | add optional `brief.evidence` map + its validation; export node/edge union types |
| `packages/schema/sample-brief.json` (modify) | populate `brief.evidence` to demo the feature |
| `packages/schema/package.json` (modify) | export `./sample-brief.json` subpath |
| `packages/dashboard/package.json` | dashboard manifest + scripts |
| `packages/dashboard/vite.config.ts` | Vite + Vitest config (jsdom, relative base) |
| `packages/dashboard/tsconfig.json` | TS config (DOM libs, react-jsx) |
| `packages/dashboard/index.html` | Vite entry HTML |
| `packages/dashboard/scripts/copy-sample.mjs` | copies the golden sample → `public/repo-brief.json` for dev/build |
| `packages/dashboard/src/test-setup.ts` | jest-dom matchers |
| `packages/dashboard/src/test-utils/sample.ts` | a validated `sampleDoc` for tests |
| `packages/dashboard/src/index.css` | all styles (layout, header, cards, chips) |
| `packages/dashboard/src/main.tsx` | fetch + validate + mount |
| `packages/dashboard/src/App.tsx` | composes Header + cards grid |
| `packages/dashboard/src/adapters/brief.ts` | `buildCards`, `buildSignals`, `resolveEvidence` + view-model types |
| `packages/dashboard/src/components/EvidenceChips.tsx` | numbered evidence chips with tooltip + verified/inferred styling |
| `packages/dashboard/src/components/BriefCard.tsx` | one prose card |
| `packages/dashboard/src/components/Header.tsx` | repo title, verdict, signal chips |

Tests are colocated as `*.test.ts(x)` next to the file they cover.

---

## Task 1: Extend the contract — `brief.evidence` (in `packages/schema`)

Add an optional per-field evidence map to `brief`, validated so every referenced id exists in `evidence[]`. Also export the node/edge union types (the dashboard's visual grammar needs them in Plan 2b, and it's a cheap, natural addition now) and export the golden sample as a package subpath so the dashboard can import it.

**Files:**
- Modify: `packages/schema/src/schema.ts`
- Modify: `packages/schema/sample-brief.json`
- Modify: `packages/schema/package.json`
- Test: `packages/schema/src/__tests__/validate.test.ts`

- [ ] **Step 1: Write failing tests for `brief.evidence`**

Append to `packages/schema/src/__tests__/validate.test.ts` (inside the existing file; `sample`, `BriefDocSchema`, and the `clone()` helper are already defined there):

```ts
describe("brief.evidence", () => {
  it("accepts the golden sample whose brief cites evidence", () => {
    const result = BriefDocSchema.safeParse(sample);
    expect(result.success).toBe(true);
    expect(result.data?.brief.evidence?.why).toEqual(["ev1"]);
  });

  it("rejects a brief.evidence reference to missing evidence", () => {
    const bad = clone();
    bad.brief.evidence = { why: ["ghost"] };
    const r = BriefDocSchema.safeParse(bad);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r)).toContain("ghost");
  });

  it("accepts a brief with no evidence map at all", () => {
    const ok = clone();
    delete ok.brief.evidence;
    const r = BriefDocSchema.safeParse(ok);
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm test --workspace @grasp/schema`
Expected: the first new test FAILS (sample has no `brief.evidence` yet, so `result.data?.brief.evidence?.why` is `undefined`, not `["ev1"]`); the "rejects missing" test FAILS (no rule yet, so it currently parses successfully). The "no evidence map" test passes.

- [ ] **Step 3: Add the `brief.evidence` field to the schema**

In `packages/schema/src/schema.ts`, find the `Brief` schema and add an `evidence` field. Replace:

```ts
const Brief = z.object({
  idea: z.string().min(1),
  problem: z.string().min(1),
  why: z.string().min(1),
  how: z.string().min(1),
  takeaway: z.string().min(1),
  updatedAt: z.object({
    essence: z.string().min(1),
    success: z.string().min(1),
    landscape: z.string().min(1),
  }),
});
```

with:

```ts
const BriefEvidence = z
  .object({
    idea: z.array(z.string()).optional(),
    problem: z.array(z.string()).optional(),
    why: z.array(z.string()).optional(),
    how: z.array(z.string()).optional(),
    takeaway: z.array(z.string()).optional(),
  })
  .optional();

const Brief = z.object({
  idea: z.string().min(1),
  problem: z.string().min(1),
  why: z.string().min(1),
  how: z.string().min(1),
  takeaway: z.string().min(1),
  updatedAt: z.object({
    essence: z.string().min(1),
    success: z.string().min(1),
    landscape: z.string().min(1),
  }),
  evidence: BriefEvidence,
});
```

- [ ] **Step 4: Validate `brief.evidence` references in `superRefine`**

In the `.superRefine((doc, ctx) => { ... })` body in `schema.ts`, immediately AFTER the two `checkEvidence` calls for graph nodes (the lines `doc.conceptGraph.nodes.forEach((n, i) => checkEvidence(...))` and `doc.landscapeGraph.nodes.forEach((n, i) => checkEvidence(...))`), add:

```ts
    if (doc.brief.evidence) {
      for (const [key, ids] of Object.entries(doc.brief.evidence)) {
        checkEvidence(ids ?? [], ["brief", "evidence", key]);
      }
    }
```

(`checkEvidence` is the helper already defined just above; it indexes each id and files an issue for any that is missing.)

- [ ] **Step 5: Add export for node/edge union types**

In `packages/schema/src/schema.ts`, immediately after the four `export const ...Types = [...] as const;` tuple declarations near the top, add:

```ts
export type ConceptNodeType = (typeof conceptNodeTypes)[number];
export type ConceptEdgeType = (typeof conceptEdgeTypes)[number];
export type LandscapeNodeType = (typeof landscapeNodeTypes)[number];
export type LandscapeEdgeType = (typeof landscapeEdgeTypes)[number];
```

- [ ] **Step 6: Populate `brief.evidence` in the golden sample**

In `packages/schema/sample-brief.json`, find the `brief` object's `updatedAt` block. It currently ends like:

```json
    "updatedAt": {
      "essence": "2026-06-08T12:00:00Z",
      "success": "2026-06-08T12:00:00Z",
      "landscape": "2026-06-08T12:00:00Z"
    }
  },
```

Change it to add an `evidence` key after `updatedAt` (note the added comma after the `updatedAt` closing brace):

```json
    "updatedAt": {
      "essence": "2026-06-08T12:00:00Z",
      "success": "2026-06-08T12:00:00Z",
      "landscape": "2026-06-08T12:00:00Z"
    },
    "evidence": { "why": ["ev1"] }
  },
```

(`ev1` — "Ships an interactive web dashboard" — backs the "why it wins" claim about rendering results in a polished dashboard. It already exists in `evidence[]`.)

- [ ] **Step 7: Export the sample as a package subpath**

In `packages/schema/package.json`, replace the `exports` field:

```json
  "exports": { ".": "./src/index.ts" },
```

with:

```json
  "exports": {
    ".": "./src/index.ts",
    "./sample-brief.json": "./sample-brief.json"
  },
```

- [ ] **Step 8: Run tests + typecheck to verify all pass**

Run: `npm test --workspace @grasp/schema && npm run typecheck --workspace @grasp/schema`
Expected: all tests pass (the three new `brief.evidence` tests included); typecheck clean.

- [ ] **Step 9: Commit**

```bash
git add packages/schema/src/schema.ts packages/schema/sample-brief.json packages/schema/package.json packages/schema/src/__tests__/validate.test.ts
git commit -m "feat(schema): add optional brief.evidence map and export sample + union types"
```

---

## Task 2: Scaffold the dashboard package

Create the Vite + React + TypeScript app skeleton with Vitest/jsdom, a dev-data copy script, a validated-sample test helper, the full stylesheet, and a placeholder `App` that renders the repo name. End with a passing smoke test.

**Files:**
- Create: `packages/dashboard/package.json`
- Create: `packages/dashboard/vite.config.ts`
- Create: `packages/dashboard/tsconfig.json`
- Create: `packages/dashboard/index.html`
- Create: `packages/dashboard/scripts/copy-sample.mjs`
- Create: `packages/dashboard/src/test-setup.ts`
- Create: `packages/dashboard/src/test-utils/sample.ts`
- Create: `packages/dashboard/src/index.css`
- Create: `packages/dashboard/src/App.tsx`
- Create: `packages/dashboard/src/main.tsx`
- Test: `packages/dashboard/src/App.test.tsx`

- [ ] **Step 1: Create the package manifest**

Create `packages/dashboard/package.json`:

```json
{
  "name": "@grasp/dashboard",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "scripts": {
    "sync-sample": "node scripts/copy-sample.mjs",
    "dev": "npm run sync-sample && vite",
    "build": "npm run sync-sample && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@grasp/schema": "*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.6",
    "@testing-library/react": "^16.0.1",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "jsdom": "^25.0.0",
    "typescript": "^5.7.0",
    "vite": "^5.4.0",
    "vitest": "^3.1.0"
  }
}
```

- [ ] **Step 2: Create the Vite + Vitest config**

Create `packages/dashboard/vite.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: { outDir: "dist" },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
```

(`base: "./"` makes the built asset URLs relative, so the vendored `dist/` works when opened from any directory or `file://`.)

- [ ] **Step 3: Create the TypeScript config**

Create `packages/dashboard/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "types": ["vitest/globals", "@testing-library/jest-dom", "node"],
    "strict": true,
    "noEmit": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 4: Create the entry HTML**

Create `packages/dashboard/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>grasp — repo brief</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create the dev-data copy script**

Create `packages/dashboard/scripts/copy-sample.mjs`:

```js
import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../../schema/sample-brief.json");
const destDir = resolve(here, "../public");
mkdirSync(destDir, { recursive: true });
copyFileSync(src, resolve(destDir, "repo-brief.json"));
console.log("Copied sample-brief.json -> public/repo-brief.json");
```

- [ ] **Step 6: Create the test setup and validated-sample helper**

Create `packages/dashboard/src/test-setup.ts`:

```ts
import "@testing-library/jest-dom";
```

Create `packages/dashboard/src/test-utils/sample.ts`:

```ts
import sampleJson from "@grasp/schema/sample-brief.json";
import { validateBrief, type BriefDoc } from "@grasp/schema";

const result = validateBrief(sampleJson);
if (!result.ok || !result.data) {
  throw new Error(`golden sample is invalid: ${result.errors.join(", ")}`);
}

export const sampleDoc: BriefDoc = result.data;
```

- [ ] **Step 7: Create the stylesheet**

Create `packages/dashboard/src/index.css`:

```css
:root {
  --bg: #0f1115;
  --panel: #181b22;
  --text: #e6e8ec;
  --muted: #9aa3b2;
  --border: #2a2f3a;
  --accent: #f5c451;
  --idea: #f5c451;
  --problem: #e5687a;
  --why: #5bd1a0;
  --how: #5aa9f0;
  --takeaway: #b794f6;
  --verified: #5bd1a0;
  --inferred: #c9a14a;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}

* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); }

.app { max-width: 1100px; margin: 0 auto; padding: 32px 24px 64px; }

.app-header { border-bottom: 1px solid var(--border); padding-bottom: 20px; margin-bottom: 28px; }
.app-title a, .app-title span { font-size: 28px; font-weight: 700; color: var(--text); text-decoration: none; }
.app-title a:hover { color: var(--accent); }
.verdict { font-size: 18px; color: var(--muted); margin: 8px 0 14px; }
.signal-chips { list-style: none; display: flex; flex-wrap: wrap; gap: 8px; padding: 0; margin: 0; }
.chip {
  font-size: 13px; color: var(--muted); background: var(--panel);
  border: 1px solid var(--border); border-radius: 999px; padding: 3px 10px;
}

.cards-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
.brief-card {
  background: var(--panel); border: 1px solid var(--border);
  border-left: 4px solid var(--border); border-radius: 10px; padding: 16px 18px;
}
.card-idea { border-left-color: var(--idea); }
.card-problem { border-left-color: var(--problem); }
.card-why { border-left-color: var(--why); }
.card-how { border-left-color: var(--how); }
.card-takeaway { border-left-color: var(--takeaway); }
.brief-card-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.brief-card h2 { font-size: 15px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin: 0 0 8px; }
.brief-card p { margin: 0; font-size: 16px; line-height: 1.5; }

.evidence-chips { display: inline-flex; gap: 4px; }
.evidence-chip {
  display: inline-flex; align-items: center; justify-content: center;
  width: 18px; height: 18px; border-radius: 50%; font-size: 11px; font-weight: 700;
  cursor: help; color: #0f1115;
}
.evidence-chip.verified { background: var(--verified); }
.evidence-chip.inferred { background: var(--inferred); }

.error-screen { color: var(--problem); padding: 32px; white-space: pre-wrap; font-family: ui-monospace, monospace; }
```

- [ ] **Step 8: Create the placeholder App**

Create `packages/dashboard/src/App.tsx`:

```tsx
import type { BriefDoc } from "@grasp/schema";

export function App({ doc }: { doc: BriefDoc }) {
  return (
    <main className="app">
      <h1>{doc.meta.repo}</h1>
    </main>
  );
}
```

- [ ] **Step 9: Create the runtime entry point**

Create `packages/dashboard/src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { validateBrief } from "@grasp/schema";
import { App } from "./App";
import "./index.css";

function ErrorScreen({ message }: { message: string }) {
  return <pre className="error-screen">{message}</pre>;
}

async function boot() {
  const root = createRoot(document.getElementById("root")!);
  try {
    const res = await fetch("./repo-brief.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    const { ok, errors, data } = validateBrief(raw);
    if (!ok || !data) {
      root.render(<ErrorScreen message={`Invalid repo-brief.json:\n${errors.join("\n")}`} />);
      return;
    }
    root.render(
      <StrictMode>
        <App doc={data} />
      </StrictMode>,
    );
  } catch (err) {
    root.render(<ErrorScreen message={`Could not load repo-brief.json: ${(err as Error).message}`} />);
  }
}

boot();
```

- [ ] **Step 10: Write the smoke test**

Create `packages/dashboard/src/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { App } from "./App";
import { sampleDoc } from "./test-utils/sample";

describe("App", () => {
  it("renders the repo name", () => {
    render(<App doc={sampleDoc} />);
    expect(screen.getByText("Lum1104/Understand-Anything")).toBeInTheDocument();
  });
});
```

- [ ] **Step 11: Install and run the smoke test + typecheck**

Run: `npm install`
Then: `npm test --workspace @grasp/dashboard && npm run typecheck --workspace @grasp/dashboard`
Expected: install links `@grasp/schema` into the workspace; the smoke test passes (1 test); typecheck clean.

> **If Vitest or the later `vite build` fails to resolve `@grasp/schema`** (it ships TypeScript *source*, not a compiled `dist/`): this is the common monorepo "consume TS source" friction. Vitest usually handles it. If `vite build` (Task 5) chokes in dep pre-bundling, add `optimizeDeps: { exclude: ["@grasp/schema"] }` to `vite.config.ts` so Vite treats it as in-tree source rather than a pre-bundled dependency. Do not add a build step to `@grasp/schema` — keeping it no-build is intentional.

- [ ] **Step 12: Verify the dev-data copy works**

Run: `npm run sync-sample --workspace @grasp/dashboard`
Expected: prints `Copied sample-brief.json -> public/repo-brief.json`; the file `packages/dashboard/public/repo-brief.json` now exists.

- [ ] **Step 13: Commit**

```bash
git add packages/dashboard package-lock.json
git commit -m "chore(dashboard): scaffold Vite/React app with validated-sample test harness"
```

(Note: `packages/dashboard/public/repo-brief.json` is generated by `sync-sample`; it is fine to commit it as dev data, or add `packages/dashboard/public/` to `.gitignore` if you prefer it generated. This plan commits it for a zero-step `npm run dev`.)

---

## Task 3: Brief adapters (pure view-model builders)

Pure functions that turn a `BriefDoc` into card and signal view models with evidence resolved. No React here — these are the testable core.

**Files:**
- Create: `packages/dashboard/src/adapters/brief.ts`
- Test: `packages/dashboard/src/adapters/brief.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/dashboard/src/adapters/brief.test.ts`:

```ts
import { buildCards, buildSignals, resolveEvidence } from "./brief";
import { sampleDoc } from "../test-utils/sample";

describe("resolveEvidence", () => {
  it("resolves known ids to chips", () => {
    const chips = resolveEvidence(sampleDoc, ["ev1"]);
    expect(chips).toHaveLength(1);
    expect(chips[0]).toMatchObject({ id: "ev1", source: "README", verified: true });
  });

  it("ignores unknown ids", () => {
    expect(resolveEvidence(sampleDoc, ["nope"])).toEqual([]);
  });
});

describe("buildCards", () => {
  it("returns five cards in fixed order with titles and bodies", () => {
    const cards = buildCards(sampleDoc);
    expect(cards.map((c) => c.key)).toEqual(["idea", "problem", "why", "how", "takeaway"]);
    expect(cards.map((c) => c.title)).toEqual([
      "Core Idea",
      "Problem",
      "Why It Wins",
      "How It Works",
      "Takeaway",
    ]);
    expect(cards[0].body).toBe(sampleDoc.brief.idea);
  });

  it("attaches resolved evidence to the why card and leaves others empty", () => {
    const cards = buildCards(sampleDoc);
    const why = cards.find((c) => c.key === "why")!;
    expect(why.evidence.map((e) => e.id)).toEqual(["ev1"]);
    const idea = cards.find((c) => c.key === "idea")!;
    expect(idea.evidence).toEqual([]);
  });
});

describe("buildSignals", () => {
  it("extracts repo, takeaway, and meta signals", () => {
    const s = buildSignals(sampleDoc);
    expect(s).toMatchObject({
      repo: "Lum1104/Understand-Anything",
      takeaway: sampleDoc.brief.takeaway,
      stars: 1200,
      language: "TypeScript",
      depth: "skim",
      broadness: "web",
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test --workspace @grasp/dashboard`
Expected: FAIL — cannot resolve `./brief`.

- [ ] **Step 3: Implement the adapters**

Create `packages/dashboard/src/adapters/brief.ts`:

```ts
import type { BriefDoc } from "@grasp/schema";

export interface EvidenceChip {
  id: string;
  claim: string;
  source: string;
  url?: string;
  verified: boolean;
}

export type BriefKey = "idea" | "problem" | "why" | "how" | "takeaway";

export interface BriefCardVM {
  key: BriefKey;
  title: string;
  body: string;
  evidence: EvidenceChip[];
}

export interface SignalsVM {
  repo: string;
  url?: string;
  takeaway: string;
  stars?: number;
  language?: string;
  depth: string;
  broadness: string;
}

const CARD_ORDER: BriefKey[] = ["idea", "problem", "why", "how", "takeaway"];

const CARD_TITLES: Record<BriefKey, string> = {
  idea: "Core Idea",
  problem: "Problem",
  why: "Why It Wins",
  how: "How It Works",
  takeaway: "Takeaway",
};

export function resolveEvidence(doc: BriefDoc, ids: string[]): EvidenceChip[] {
  const byId = new Map(doc.evidence.map((e) => [e.id, e]));
  const chips: EvidenceChip[] = [];
  for (const id of ids) {
    const e = byId.get(id);
    if (e) {
      chips.push({ id: e.id, claim: e.claim, source: e.source, url: e.url, verified: e.verified });
    }
  }
  return chips;
}

export function buildCards(doc: BriefDoc): BriefCardVM[] {
  const evidenceMap: NonNullable<BriefDoc["brief"]["evidence"]> = doc.brief.evidence ?? {};
  return CARD_ORDER.map((key) => ({
    key,
    title: CARD_TITLES[key],
    body: doc.brief[key],
    evidence: resolveEvidence(doc, evidenceMap[key] ?? []),
  }));
}

export function buildSignals(doc: BriefDoc): SignalsVM {
  return {
    repo: doc.meta.repo,
    url: doc.meta.url,
    takeaway: doc.brief.takeaway,
    stars: doc.meta.signals.stars,
    language: doc.meta.signals.language,
    depth: doc.meta.depth,
    broadness: doc.meta.broadness,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --workspace @grasp/dashboard && npm run typecheck --workspace @grasp/dashboard`
Expected: all pass (smoke + 5 adapter tests); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add packages/dashboard/src/adapters/brief.ts packages/dashboard/src/adapters/brief.test.ts
git commit -m "feat(dashboard): add brief/signals/evidence adapters"
```

---

## Task 4: Presentational components (EvidenceChips, BriefCard, Header)

Dumb components that render the view models. Tested with Testing Library against `sampleDoc`-derived view models.

**Files:**
- Create: `packages/dashboard/src/components/EvidenceChips.tsx`
- Create: `packages/dashboard/src/components/BriefCard.tsx`
- Create: `packages/dashboard/src/components/Header.tsx`
- Test: `packages/dashboard/src/components/components.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `packages/dashboard/src/components/components.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { EvidenceChips } from "./EvidenceChips";
import { BriefCard } from "./BriefCard";
import { Header } from "./Header";
import type { BriefCardVM, EvidenceChip, SignalsVM } from "../adapters/brief";

const chips: EvidenceChip[] = [
  { id: "ev1", claim: "Ships a dashboard", source: "README", url: "https://x", verified: true },
  { id: "ev2", claim: "Guessed", source: "inference", verified: false },
];

describe("EvidenceChips", () => {
  it("renders one chip per evidence with verified/inferred styling", () => {
    render(<EvidenceChips evidence={chips} />);
    const rendered = screen.getAllByTestId("evidence-chip");
    expect(rendered).toHaveLength(2);
    expect(rendered[0]).toHaveClass("verified");
    expect(rendered[1]).toHaveClass("inferred");
    expect(rendered[0]).toHaveAttribute("title", expect.stringContaining("Ships a dashboard"));
  });

  it("renders nothing when there is no evidence", () => {
    const { container } = render(<EvidenceChips evidence={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("BriefCard", () => {
  const card: BriefCardVM = { key: "why", title: "Why It Wins", body: "Because reasons.", evidence: chips };

  it("renders the title, body, key-scoped class, and chips", () => {
    render(<BriefCard card={card} />);
    expect(screen.getByText("Why It Wins")).toBeInTheDocument();
    expect(screen.getByText("Because reasons.")).toBeInTheDocument();
    expect(screen.getByTestId("card-why")).toHaveClass("card-why");
    expect(screen.getAllByTestId("evidence-chip")).toHaveLength(2);
  });
});

describe("Header", () => {
  const signals: SignalsVM = {
    repo: "owner/repo",
    url: "https://github.com/owner/repo",
    takeaway: "Worth it.",
    stars: 1200,
    language: "TypeScript",
    depth: "skim",
    broadness: "web",
  };

  it("renders repo link, verdict, and signal chips", () => {
    render(<Header signals={signals} />);
    const link = screen.getByRole("link", { name: "owner/repo" });
    expect(link).toHaveAttribute("href", "https://github.com/owner/repo");
    expect(screen.getByText("Worth it.")).toBeInTheDocument();
    expect(screen.getByText("★ 1,200")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("depth: skim")).toBeInTheDocument();
    expect(screen.getByText("scope: web")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test --workspace @grasp/dashboard`
Expected: FAIL — cannot resolve `./EvidenceChips`, `./BriefCard`, `./Header`.

- [ ] **Step 3: Implement EvidenceChips**

Create `packages/dashboard/src/components/EvidenceChips.tsx`:

```tsx
import type { EvidenceChip } from "../adapters/brief";

export function EvidenceChips({ evidence }: { evidence: EvidenceChip[] }) {
  if (evidence.length === 0) return null;
  return (
    <span className="evidence-chips">
      {evidence.map((e, i) => (
        <span
          key={e.id}
          data-testid="evidence-chip"
          className={`evidence-chip ${e.verified ? "verified" : "inferred"}`}
          title={`${e.claim} — ${e.source} (${e.verified ? "verified" : "inferred"})`}
        >
          {i + 1}
        </span>
      ))}
    </span>
  );
}
```

- [ ] **Step 4: Implement BriefCard**

Create `packages/dashboard/src/components/BriefCard.tsx`:

```tsx
import type { BriefCardVM } from "../adapters/brief";
import { EvidenceChips } from "./EvidenceChips";

export function BriefCard({ card }: { card: BriefCardVM }) {
  return (
    <article className={`brief-card card-${card.key}`} data-testid={`card-${card.key}`}>
      <div className="brief-card-head">
        <h2>{card.title}</h2>
        <EvidenceChips evidence={card.evidence} />
      </div>
      <p>{card.body}</p>
    </article>
  );
}
```

- [ ] **Step 5: Implement Header**

Create `packages/dashboard/src/components/Header.tsx`:

```tsx
import type { SignalsVM } from "../adapters/brief";

export function Header({ signals }: { signals: SignalsVM }) {
  return (
    <header className="app-header">
      <div className="app-title">
        {signals.url ? (
          <a href={signals.url} target="_blank" rel="noreferrer">
            {signals.repo}
          </a>
        ) : (
          <span>{signals.repo}</span>
        )}
      </div>
      <p className="verdict">{signals.takeaway}</p>
      <ul className="signal-chips">
        {signals.stars !== undefined && <li className="chip">★ {signals.stars.toLocaleString("en-US")}</li>}
        {signals.language && <li className="chip">{signals.language}</li>}
        <li className="chip">depth: {signals.depth}</li>
        <li className="chip">scope: {signals.broadness}</li>
      </ul>
    </header>
  );
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test --workspace @grasp/dashboard && npm run typecheck --workspace @grasp/dashboard`
Expected: all pass (smoke + adapters + component tests); typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add packages/dashboard/src/components
git commit -m "feat(dashboard): add EvidenceChips, BriefCard, and Header components"
```

---

## Task 5: Compose the App and produce the vendored build

Wire Header + cards grid into `App`, then verify a production build emits a self-contained `dist/` (including `repo-brief.json` from `public/`).

**Files:**
- Modify: `packages/dashboard/src/App.tsx`
- Test: `packages/dashboard/src/App.test.tsx`

- [ ] **Step 1: Update the App test to assert the full composition**

Replace the entire contents of `packages/dashboard/src/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { App } from "./App";
import { sampleDoc } from "./test-utils/sample";

describe("App", () => {
  it("renders the header repo name and all five brief cards", () => {
    render(<App doc={sampleDoc} />);
    expect(screen.getByText("Lum1104/Understand-Anything")).toBeInTheDocument();
    for (const key of ["idea", "problem", "why", "how", "takeaway"]) {
      expect(screen.getByTestId(`card-${key}`)).toBeInTheDocument();
    }
  });

  it("renders the why card's evidence chip from the sample", () => {
    render(<App doc={sampleDoc} />);
    const whyCard = screen.getByTestId("card-why");
    expect(whyCard.querySelectorAll('[data-testid="evidence-chip"]')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace @grasp/dashboard`
Expected: FAIL — the placeholder `App` renders only an `<h1>`, so `card-idea` etc. are not found.

- [ ] **Step 3: Implement the composed App**

Replace the entire contents of `packages/dashboard/src/App.tsx`:

```tsx
import type { BriefDoc } from "@grasp/schema";
import { buildCards, buildSignals } from "./adapters/brief";
import { Header } from "./components/Header";
import { BriefCard } from "./components/BriefCard";

export function App({ doc }: { doc: BriefDoc }) {
  const signals = buildSignals(doc);
  const cards = buildCards(doc);
  return (
    <main className="app">
      <Header signals={signals} />
      <section className="cards-grid">
        {cards.map((card) => (
          <BriefCard key={card.key} card={card} />
        ))}
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npm test --workspace @grasp/dashboard && npm run typecheck --workspace @grasp/dashboard`
Expected: all pass; typecheck clean.

- [ ] **Step 5: Produce the production build**

Run: `npm run build --workspace @grasp/dashboard`
Expected: build succeeds; `packages/dashboard/dist/` contains `index.html`, an `assets/` directory with hashed JS/CSS, and `repo-brief.json` (copied from `public/` by `sync-sample` and emitted by Vite).

- [ ] **Step 6: Verify the build output is self-contained**

Run: `ls packages/dashboard/dist && test -f packages/dashboard/dist/repo-brief.json && grep -q "./assets/" packages/dashboard/dist/index.html && echo "OK: relative assets + repo-brief.json present"`
Expected: prints `OK: relative assets + repo-brief.json present` (confirms `base: "./"` produced relative asset URLs and the brief data is bundled — so the skill can later drop a real `repo-brief.json` beside `index.html` and the page works from `file://`).

- [ ] **Step 7: Commit**

```bash
git add packages/dashboard/src/App.tsx packages/dashboard/src/App.test.tsx
git commit -m "feat(dashboard): compose Header + brief cards into the App"
```

(Note: `dist/` is build output — leave it untracked/gitignored. The plugin packaging step in Plan 3 decides whether to commit a vendored build; do not commit `dist/` here.)

---

## Definition of Done

- `npm test --workspace @grasp/schema` passes including the three new `brief.evidence` tests.
- `npm test --workspace @grasp/dashboard` passes (smoke + adapters + components + App composition).
- `npm run typecheck --workspace @grasp/dashboard` is clean.
- `npm run build --workspace @grasp/dashboard` emits a self-contained `dist/` with relative asset URLs and a bundled `repo-brief.json`.
- Opening the built `dist/index.html` (served, or via the skill later) renders the header + five evidence-backed prose cards for the golden sample.
- The schema contract now supports prose-card evidence (`brief.evidence`), unblocking the trust-tooltip UX; `@grasp/schema` exports the golden sample and node/edge union types for Plan 2b.

**Out of scope (Plan 2b):** the concept and landscape SVG graphs, graph/card layout tabs, and the graph adapters/layout functions.
