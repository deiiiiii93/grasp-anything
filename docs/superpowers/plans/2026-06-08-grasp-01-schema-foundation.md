# Grasp — Plan 1: Schema Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `packages/schema` — the `repo-brief.json` contract (Zod schema + inferred TypeScript types), a validator with cross-field rules, a CLI, and a golden sample brief — fully tested.

**Architecture:** A single source of truth (a Zod schema) defines both the runtime validator and the static TypeScript types via `z.infer`. Structural rules are expressed in Zod; cross-field rules (exactly-one-idea-node, dangling edge/evidence references, required fields on `alternative` nodes) are added via `superRefine`. The package runs directly from TypeScript via `tsx` (no build step); the skill and the dashboard both consume it through the npm workspace.

**Tech Stack:** Node 22, npm workspaces, TypeScript, Zod ^3.23, Vitest, tsx.

**This is Plan 1 of 4.** Subsequent plans build on this contract:
- Plan 2 — `packages/dashboard` (React/Vite, renders the golden sample)
- Plan 3 — `agents/*` + `skills/grasp/SKILL.md` (the analysis pipeline)
- Plan 4 — incremental re-analysis (fingerprints, `state.json`, `--auto-update` hook)

Spec: `docs/superpowers/specs/2026-06-08-grasp-design.md` (§4 Data Contract is the source for everything here).

---

## File Structure

| File | Responsibility |
|---|---|
| `package.json` (root) | npm workspace declaration |
| `packages/schema/package.json` | schema package manifest + scripts |
| `packages/schema/tsconfig.json` | TS config (bundler resolution, JSON imports) |
| `packages/schema/vitest.config.ts` | test runner config |
| `packages/schema/src/schema.ts` | Zod schemas + `superRefine` rules + inferred `BriefDoc` type |
| `packages/schema/src/validate.ts` | `validateBrief()` → `{ ok, errors }` |
| `packages/schema/src/cli.ts` | CLI: read a file, validate, exit 0/1/2 |
| `packages/schema/src/index.ts` | public exports |
| `packages/schema/sample-brief.json` | golden valid brief (test fixture + dashboard dev data) |
| `packages/schema/src/__tests__/validate.test.ts` | validator unit tests |

---

## Task 1: Scaffold the workspace and schema package

**Files:**
- Create: `package.json` (root)
- Create: `packages/schema/package.json`
- Create: `packages/schema/tsconfig.json`
- Create: `packages/schema/vitest.config.ts`
- Create: `packages/schema/src/index.ts`
- Test: `packages/schema/src/__tests__/smoke.test.ts`

- [ ] **Step 1: Create the root workspace manifest**

Create `package.json`:

```json
{
  "name": "grasp",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*"],
  "engines": { "node": ">=22" }
}
```

- [ ] **Step 2: Create the schema package manifest**

Create `packages/schema/package.json`:

```json
{
  "name": "@grasp/schema",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "bin": { "grasp-validate": "src/cli.ts" },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "validate": "tsx src/cli.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.1.0"
  }
}
```

- [ ] **Step 3: Create the TypeScript config**

Create `packages/schema/tsconfig.json`:

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
  "include": ["src", "sample-brief.json"]
}
```

- [ ] **Step 4: Create the Vitest config**

Create `packages/schema/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 5: Create the public exports placeholder**

Create `packages/schema/src/index.ts`:

```ts
export const SCHEMA_VERSION = "0.1.0";
```

- [ ] **Step 6: Write a smoke test**

Create `packages/schema/src/__tests__/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { SCHEMA_VERSION } from "../index";

describe("schema package", () => {
  it("exposes a version", () => {
    expect(SCHEMA_VERSION).toBe("0.1.0");
  });
});
```

- [ ] **Step 7: Install dependencies and run the smoke test**

Run: `npm install`
Then: `npm test --workspace @grasp/schema`
Expected: Vitest runs, `1 passed`, exit code 0.

- [ ] **Step 8: Commit**

```bash
git add package.json packages/schema package-lock.json
git commit -m "chore(schema): scaffold workspace and @grasp/schema package"
```

---

## Task 2: Author the golden sample brief

**Files:**
- Create: `packages/schema/sample-brief.json`

This is a hand-authored, intentionally-valid brief (about Understand-Anything itself). It is the fixture every later test and the dashboard dev server load. It must satisfy every rule we implement in Tasks 3–4: exactly one `idea` node, exactly one `self` node, all edge endpoints resolve, all `evidenceIds` resolve, `alternative` nodes carry `name` + `url`, and all five `brief.*` prose fields are non-empty.

- [ ] **Step 1: Create the sample brief**

Create `packages/schema/sample-brief.json`:

```json
{
  "meta": {
    "repo": "Lum1104/Understand-Anything",
    "url": "https://github.com/Lum1104/Understand-Anything",
    "analyzedAt": "2026-06-08T12:00:00Z",
    "depth": "skim",
    "broadness": "web",
    "signals": { "stars": 1200, "lastCommit": "2026-06-01", "language": "TypeScript" }
  },
  "brief": {
    "idea": "Turn any codebase into an interactive knowledge graph so newcomers can grasp its architecture without reading every file.",
    "problem": "Onboarding into an unfamiliar codebase is slow and intimidating; engineers must reverse-engineer structure from scattered files.",
    "why": "It packages a heavy LLM analysis pipeline behind a one-command plugin and renders results in a polished dashboard, lowering the effort to near zero.",
    "how": "LLM sub-agents analyze files in batches and emit a validated JSON graph; a deterministic core validates and fingerprints it; a React dashboard renders it with layered layout.",
    "takeaway": "Worth it if you regularly onboard onto large or unfamiliar repos.",
    "updatedAt": {
      "essence": "2026-06-08T12:00:00Z",
      "success": "2026-06-08T12:00:00Z",
      "landscape": "2026-06-08T12:00:00Z"
    }
  },
  "conceptGraph": {
    "nodes": [
      { "id": "p1", "type": "problem", "label": "Codebases are hard to onboard into", "detail": "Structure is implicit and spread across many files.", "evidenceIds": [] },
      { "id": "idea1", "type": "idea", "label": "Repo as an interactive knowledge graph", "detail": "Nodes are files/symbols; edges are imports/calls.", "evidenceIds": [] },
      { "id": "m1", "type": "mechanism", "label": "LLM agents emit a validated JSON graph", "detail": "Batched file analysis by sub-agents.", "evidenceIds": [] },
      { "id": "m2", "type": "mechanism", "label": "Deterministic core validates and fingerprints", "detail": "Schema validation + change detection.", "evidenceIds": [] },
      { "id": "o1", "type": "outcome", "label": "Interactive architecture dashboard", "detail": "Layered, zoomable graph view.", "evidenceIds": ["ev1"] },
      { "id": "f1", "type": "feature", "label": "Incremental graph updates on commit", "detail": "Only changed files are re-analyzed.", "evidenceIds": [] }
    ],
    "edges": [
      { "id": "ce1", "source": "idea1", "target": "p1", "type": "addresses" },
      { "id": "ce2", "source": "idea1", "target": "m1", "type": "composedOf" },
      { "id": "ce3", "source": "idea1", "target": "m2", "type": "composedOf" },
      { "id": "ce4", "source": "m1", "target": "o1", "type": "enables" },
      { "id": "ce5", "source": "m2", "target": "f1", "type": "produces" }
    ]
  },
  "landscapeGraph": {
    "nodes": [
      { "id": "self1", "type": "self", "name": "Understand-Anything", "url": "https://github.com/Lum1104/Understand-Anything", "category": "cat1", "evidenceIds": [] },
      { "id": "alt1", "type": "alternative", "name": "Sourcegraph Cody", "url": "https://github.com/sourcegraph/cody", "stars": 3000, "oneLiner": "AI coding assistant with codebase context.", "similarity": 0.55, "differentiator": "Commercial, IDE-embedded, not a static graph.", "category": "cat1", "evidenceIds": ["ev2"] },
      { "id": "alt2", "type": "alternative", "name": "CodeSee", "url": "https://github.com/Codesee-io", "stars": 800, "oneLiner": "Visual maps of a codebase.", "similarity": 0.7, "differentiator": "Hosted SaaS; less LLM-driven narrative.", "category": "cat1", "evidenceIds": [] },
      { "id": "cat1", "type": "category", "label": "Code comprehension tools", "evidenceIds": [] }
    ],
    "edges": [
      { "id": "le1", "source": "alt1", "target": "self1", "type": "alternativeTo" },
      { "id": "le2", "source": "alt2", "target": "self1", "type": "competesWith" },
      { "id": "le3", "source": "alt1", "target": "alt2", "type": "sharesApproach" }
    ]
  },
  "evidence": [
    { "id": "ev1", "claim": "Ships an interactive web dashboard", "source": "README", "url": "https://github.com/Lum1104/Understand-Anything", "verified": true },
    { "id": "ev2", "claim": "Cody has 3k+ GitHub stars", "source": "GitHub", "url": "https://github.com/sourcegraph/cody", "verified": true }
  ]
}
```

- [ ] **Step 2: Verify it is valid JSON**

Run: `node --input-type=module -e "import('node:fs').then(fs => { JSON.parse(fs.readFileSync('packages/schema/sample-brief.json','utf8')); console.log('valid JSON'); })"`
Expected: prints `valid JSON`, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add packages/schema/sample-brief.json
git commit -m "feat(schema): add golden sample-brief.json fixture"
```

---

## Task 3: Define the Zod schema and inferred types

**Files:**
- Create: `packages/schema/src/schema.ts`
- Modify: `packages/schema/src/index.ts`
- Test: `packages/schema/src/__tests__/validate.test.ts`

- [ ] **Step 1: Write the failing test (golden sample parses)**

Create `packages/schema/src/__tests__/validate.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import sample from "../../sample-brief.json";
import { BriefDocSchema } from "../schema";

describe("BriefDocSchema", () => {
  it("accepts the golden sample brief", () => {
    const result = BriefDocSchema.safeParse(sample);
    if (!result.success) {
      console.error(result.error.issues);
    }
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace @grasp/schema`
Expected: FAIL — cannot resolve `../schema` (module does not exist yet).

- [ ] **Step 3: Implement the schema**

Create `packages/schema/src/schema.ts`:

```ts
import { z } from "zod";

export const conceptNodeTypes = ["problem", "idea", "mechanism", "outcome", "feature"] as const;
export const conceptEdgeTypes = ["addresses", "composedOf", "enables", "produces"] as const;
export const landscapeNodeTypes = ["self", "alternative", "category"] as const;
export const landscapeEdgeTypes = ["competesWith", "sharesApproach", "alternativeTo"] as const;

const ConceptNode = z.object({
  id: z.string().min(1),
  type: z.enum(conceptNodeTypes),
  label: z.string().min(1),
  detail: z.string().default(""),
  evidenceIds: z.array(z.string()).default([]),
});

const ConceptEdge = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  type: z.enum(conceptEdgeTypes),
});

const LandscapeNode = z.object({
  id: z.string().min(1),
  type: z.enum(landscapeNodeTypes),
  name: z.string().optional(),
  label: z.string().optional(),
  url: z.string().url().optional(),
  stars: z.number().int().nonnegative().optional(),
  oneLiner: z.string().optional(),
  similarity: z.number().min(0).max(1).optional(),
  differentiator: z.string().optional(),
  category: z.string().optional(),
  evidenceIds: z.array(z.string()).default([]),
});

const LandscapeEdge = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  type: z.enum(landscapeEdgeTypes),
});

const Evidence = z.object({
  id: z.string().min(1),
  claim: z.string().min(1),
  source: z.string().min(1),
  url: z.string().url().optional(),
  verified: z.boolean(),
});

const Meta = z.object({
  repo: z.string().min(1),
  url: z.string().url().optional(),
  analyzedAt: z.string().min(1),
  depth: z.enum(["docs", "skim", "deep"]),
  broadness: z.enum(["offline", "web"]),
  signals: z
    .object({
      stars: z.number().int().nonnegative().optional(),
      lastCommit: z.string().optional(),
      language: z.string().optional(),
    })
    .default({}),
});

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

export const BriefDocSchema = z.object({
  meta: Meta,
  brief: Brief,
  conceptGraph: z.object({ nodes: z.array(ConceptNode), edges: z.array(ConceptEdge) }),
  landscapeGraph: z.object({ nodes: z.array(LandscapeNode), edges: z.array(LandscapeEdge) }),
  evidence: z.array(Evidence),
});

export type BriefDoc = z.infer<typeof BriefDocSchema>;
```

- [ ] **Step 4: Export the schema**

Replace the contents of `packages/schema/src/index.ts`:

```ts
export const SCHEMA_VERSION = "0.1.0";
export * from "./schema";
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test --workspace @grasp/schema`
Expected: PASS — `BriefDocSchema accepts the golden sample brief`. Smoke test still passes.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck --workspace @grasp/schema`
Expected: no errors, exit code 0.

- [ ] **Step 7: Commit**

```bash
git add packages/schema/src/schema.ts packages/schema/src/index.ts packages/schema/src/__tests__/validate.test.ts
git commit -m "feat(schema): add Zod brief schema and inferred BriefDoc type"
```

---

## Task 4: Add cross-field validation rules

The base schema validates shape and enums, but not relationships. Add `superRefine` so the four cross-field rules from spec §4 are enforced, and prove each with a failing fixture.

**Files:**
- Modify: `packages/schema/src/schema.ts`
- Test: `packages/schema/src/__tests__/validate.test.ts`

- [ ] **Step 1: Write failing tests for each cross-field rule**

Append to `packages/schema/src/__tests__/validate.test.ts`:

```ts
// Appended to the existing validate.test.ts. `sample` and `BriefDocSchema`
// are already imported at the top of the file from Task 3.

function clone() {
  return JSON.parse(JSON.stringify(sample)) as any;
}

describe("cross-field rules", () => {
  it("rejects a second idea node", () => {
    const bad = clone();
    bad.conceptGraph.nodes.push({ id: "idea2", type: "idea", label: "Another idea", detail: "", evidenceIds: [] });
    const r = BriefDocSchema.safeParse(bad);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r).toLowerCase()).toContain("exactly one 'idea'");
  });

  it("rejects zero self nodes", () => {
    const bad = clone();
    bad.landscapeGraph.nodes = bad.landscapeGraph.nodes.filter((n: any) => n.type !== "self");
    const r = BriefDocSchema.safeParse(bad);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r).toLowerCase()).toContain("exactly one 'self'");
  });

  it("rejects a concept edge with a dangling endpoint", () => {
    const bad = clone();
    bad.conceptGraph.edges.push({ id: "ceX", source: "idea1", target: "nope", type: "enables" });
    const r = BriefDocSchema.safeParse(bad);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r)).toContain("nope");
  });

  it("rejects a node referencing missing evidence", () => {
    const bad = clone();
    bad.conceptGraph.nodes[0].evidenceIds = ["ghost"];
    const r = BriefDocSchema.safeParse(bad);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r)).toContain("ghost");
  });

  it("rejects an alternative node missing name or url", () => {
    const bad = clone();
    delete bad.landscapeGraph.nodes.find((n: any) => n.id === "alt1").url;
    const r = BriefDocSchema.safeParse(bad);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r).toLowerCase()).toContain("alternative");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace @grasp/schema`
Expected: the 5 new tests FAIL (the malformed docs currently pass the base schema). The golden-sample test still passes.

- [ ] **Step 3: Implement the cross-field rules**

In `packages/schema/src/schema.ts`, replace the `export const BriefDocSchema = z.object({ ... });` block with the same object followed by a `.superRefine(...)`:

```ts
export const BriefDocSchema = z
  .object({
    meta: Meta,
    brief: Brief,
    conceptGraph: z.object({ nodes: z.array(ConceptNode), edges: z.array(ConceptEdge) }),
    landscapeGraph: z.object({ nodes: z.array(LandscapeNode), edges: z.array(LandscapeEdge) }),
    evidence: z.array(Evidence),
  })
  .superRefine((doc, ctx) => {
    const ideaCount = doc.conceptGraph.nodes.filter((n) => n.type === "idea").length;
    if (ideaCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `conceptGraph must have exactly one 'idea' node, found ${ideaCount}`,
        path: ["conceptGraph", "nodes"],
      });
    }

    const selfCount = doc.landscapeGraph.nodes.filter((n) => n.type === "self").length;
    if (selfCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `landscapeGraph must have exactly one 'self' node, found ${selfCount}`,
        path: ["landscapeGraph", "nodes"],
      });
    }

    const conceptIds = new Set(doc.conceptGraph.nodes.map((n) => n.id));
    doc.conceptGraph.edges.forEach((e, i) => {
      if (!conceptIds.has(e.source)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `concept edge '${e.id}' source '${e.source}' not found`, path: ["conceptGraph", "edges", i, "source"] });
      }
      if (!conceptIds.has(e.target)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `concept edge '${e.id}' target '${e.target}' not found`, path: ["conceptGraph", "edges", i, "target"] });
      }
    });

    const landIds = new Set(doc.landscapeGraph.nodes.map((n) => n.id));
    doc.landscapeGraph.edges.forEach((e, i) => {
      if (!landIds.has(e.source)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `landscape edge '${e.id}' source '${e.source}' not found`, path: ["landscapeGraph", "edges", i, "source"] });
      }
      if (!landIds.has(e.target)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `landscape edge '${e.id}' target '${e.target}' not found`, path: ["landscapeGraph", "edges", i, "target"] });
      }
    });

    const evidenceIds = new Set(doc.evidence.map((e) => e.id));
    const checkEvidence = (ids: string[], path: (string | number)[]) => {
      ids.forEach((id) => {
        if (!evidenceIds.has(id)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `references missing evidence '${id}'`, path });
        }
      });
    };
    doc.conceptGraph.nodes.forEach((n, i) => checkEvidence(n.evidenceIds, ["conceptGraph", "nodes", i, "evidenceIds"]));
    doc.landscapeGraph.nodes.forEach((n, i) => checkEvidence(n.evidenceIds, ["landscapeGraph", "nodes", i, "evidenceIds"]));

    doc.landscapeGraph.nodes.forEach((n, i) => {
      if (n.type === "alternative" && (!n.name || !n.url)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `alternative node '${n.id}' requires both name and url`, path: ["landscapeGraph", "nodes", i] });
      }
    });
  });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --workspace @grasp/schema`
Expected: all tests PASS — golden sample valid; all 5 malformed cases rejected with the expected messages.

- [ ] **Step 5: Commit**

```bash
git add packages/schema/src/schema.ts packages/schema/src/__tests__/validate.test.ts
git commit -m "feat(schema): enforce cross-field rules via superRefine"
```

---

## Task 5: Add the validator wrapper and CLI

The skill (Plan 3) needs a programmatic `validateBrief()` returning flat error strings, and a CLI it can shell out to. Build both on top of `BriefDocSchema`.

**Files:**
- Create: `packages/schema/src/validate.ts`
- Create: `packages/schema/src/cli.ts`
- Modify: `packages/schema/src/index.ts`
- Test: `packages/schema/src/__tests__/wrapper.test.ts`

- [ ] **Step 1: Write the failing test for `validateBrief`**

Create `packages/schema/src/__tests__/wrapper.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import sample from "../../sample-brief.json";
import { validateBrief } from "../validate";

describe("validateBrief", () => {
  it("returns ok for the golden sample", () => {
    const result = validateBrief(sample);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("returns flat, readable error strings for an invalid brief", () => {
    const bad = JSON.parse(JSON.stringify(sample));
    bad.brief.idea = "";
    const result = validateBrief(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("brief.idea");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace @grasp/schema`
Expected: FAIL — cannot resolve `../validate`.

- [ ] **Step 3: Implement `validateBrief`**

Create `packages/schema/src/validate.ts`:

```ts
import { BriefDocSchema, type BriefDoc } from "./schema";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  data?: BriefDoc;
}

export function validateBrief(data: unknown): ValidationResult {
  const result = BriefDocSchema.safeParse(data);
  if (result.success) {
    return { ok: true, errors: [], data: result.data };
  }
  const errors = result.error.issues.map((issue) => {
    const path = issue.path.join(".") || "(root)";
    return `${path}: ${issue.message}`;
  });
  return { ok: false, errors };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --workspace @grasp/schema`
Expected: PASS — both wrapper tests green.

- [ ] **Step 5: Write the CLI**

Create `packages/schema/src/cli.ts`:

```ts
import { readFileSync } from "node:fs";
import { validateBrief } from "./validate";

function main(): number {
  const path = process.argv[2];
  if (!path) {
    console.error("usage: grasp-validate <repo-brief.json>");
    return 2;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    console.error(`Cannot read or parse ${path}: ${(err as Error).message}`);
    return 2;
  }

  const { ok, errors } = validateBrief(parsed);
  if (ok) {
    console.log(`✓ ${path} is a valid repo-brief`);
    return 0;
  }

  console.error(`✗ ${path} is invalid:`);
  for (const e of errors) console.error(`  - ${e}`);
  return 1;
}

process.exit(main());
```

- [ ] **Step 6: Export the wrapper**

Replace the contents of `packages/schema/src/index.ts`:

```ts
export const SCHEMA_VERSION = "0.1.0";
export * from "./schema";
export * from "./validate";
```

- [ ] **Step 7: Verify the CLI succeeds on the golden sample**

Run: `npm run validate --workspace @grasp/schema -- sample-brief.json`
Expected: prints `✓ sample-brief.json is a valid repo-brief`, exit code 0.

- [ ] **Step 8: Verify the CLI fails on an invalid file**

Run: `node --input-type=module -e "import('node:fs').then(fs => fs.writeFileSync('/tmp/bad-brief.json', JSON.stringify({})))"`
Then: `npm run validate --workspace @grasp/schema -- /tmp/bad-brief.json; echo "exit=$?"`
Expected: prints `✗ /tmp/bad-brief.json is invalid:` followed by error lines (e.g. `meta: Required`), then `exit=1`.

- [ ] **Step 9: Typecheck and run the full suite**

Run: `npm run typecheck --workspace @grasp/schema && npm test --workspace @grasp/schema`
Expected: typecheck clean; all tests pass.

- [ ] **Step 10: Commit**

```bash
git add packages/schema/src/validate.ts packages/schema/src/cli.ts packages/schema/src/index.ts packages/schema/src/__tests__/wrapper.test.ts
git commit -m "feat(schema): add validateBrief wrapper and CLI"
```

---

## Definition of Done

- `npm test --workspace @grasp/schema` passes (smoke + schema + cross-field + wrapper tests).
- `npm run typecheck --workspace @grasp/schema` is clean.
- `npm run validate --workspace @grasp/schema -- sample-brief.json` exits 0; an empty `{}` exits 1 with readable errors.
- `@grasp/schema` exports `BriefDoc`, `BriefDocSchema`, `validateBrief`, `ValidationResult`, and the node/edge type tuples for downstream plans to import.
- `packages/schema/sample-brief.json` is a committed, valid golden fixture ready to seed the dashboard (Plan 2).
