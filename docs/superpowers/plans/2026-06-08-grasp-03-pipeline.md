# `/grasp` Pipeline (Agents + Orchestrator) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the engine that turns a real repo into a validated `repo-brief.json` and a rendered dashboard — the three analyzer agents, a deterministic assemble/render core, the `skills/grasp/SKILL.md` orchestrator, and the plugin manifest.

**Architecture:** A new `packages/pipeline` workspace holds the *deterministic* seam — per-agent **fragment schemas**, an `assemble()` that merges three agent fragments into a schema-valid `BriefDoc`, and a `render()` that writes the brief beside the vendored dashboard `dist/`. The `agents/*.md` prompts and `skills/grasp/SKILL.md` orchestrator are prose, but each is held to the executable contract by drift-guard tests (embedded examples are extracted and validated; the orchestrator is asserted to reference the real command and agent files). The load-bearing principle is unchanged: **LLM produces judgment, deterministic code renders it, `repo-brief.json` is the only contract.**

**Tech Stack:** TypeScript (no build; run via `tsx`), Zod (reusing `@grasp/schema`), Vitest, Node ≥22 `fs` (`cpSync`). npm workspaces.

---

## Design decisions resolved in this plan

The design spec (§4–§8) left a few seams implicit. This plan makes them explicit:

1. **`brief.takeaway` is owned by `success-analyzer`.** Spec §6 assigns idea/problem/how to essence and why to success, but never assigns `takeaway`. The takeaway is the "should I care?" *verdict* — a value judgment, same axis as "why it wins" — so success-analyzer emits both `why` and `takeaway`.
2. **`brief.evidence` (per-prose citations) is populated from per-fragment `briefEvidence` maps.** Plan 2 made the prose cards render evidence chips off `doc.brief.evidence`. So each fragment optionally declares which evidence ids back *its own* prose fields (`essence.briefEvidence.{idea,problem,how}`, `success.briefEvidence.{why,takeaway}`); `assemble()` merges them. Evidence may be *introduced* by one fragment and *cited* by another — that is fine, because…
3. **Fragment schemas validate shape only; referential integrity is checked once on the assembled whole.** A fragment validated alone cannot resolve a cross-fragment evidence id, so fragment schemas do **not** check evidence resolution, the one-idea rule, or the one-self rule. `validateBrief` (already built, Plan 1) enforces all of those on the assembled `BriefDoc`.
4. **Offline mode synthesizes a self-only landscape.** Spec §6 says landscape-analyzer is "skipped if offline," but the schema requires exactly one `self` node. So when no landscape fragment is supplied, `assemble()` synthesizes a minimal landscape graph containing just the `self` node (from `meta.repo`/`meta.url`), keeping the brief valid with an empty competitive field.
5. **The "one repair pass" (spec §8) is orchestrated by the SKILL, not by code.** The deterministic CLI only assembles, validates, and reports errors (exit 1). Re-dispatching the offending agent to fix its fragment is a judgment step described in `SKILL.md`.

---

## File structure

```
packages/pipeline/                         # NEW workspace — the deterministic seam
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── src/
    ├── index.ts                           # public exports
    ├── fragments.ts                        # EssenceFragment/SuccessFragment/LandscapeFragment schemas
    ├── assemble.ts                         # assemble(meta, essence, success, landscape?) -> BriefDoc
    ├── render.ts                           # render(doc, targetDir, distDir) -> writes .grasp/dashboard
    ├── cli-run.ts                          # runCli(argv): testable CLI logic
    ├── cli.ts                              # #!/usr/bin/env tsx bin wrapper
    └── __tests__/
        ├── smoke.test.ts
        ├── fragments.test.ts
        ├── assemble.test.ts
        ├── render.test.ts
        ├── cli.test.ts
        ├── agent-contracts.test.ts         # extracts + validates agent .md examples (reaches repo root)
        ├── skill-contract.test.ts          # drift-guards SKILL.md
        ├── plugin.test.ts                  # validates plugin manifest + e2e capstone
        └── fixtures/
            ├── meta.json
            ├── essence.json
            ├── success.json
            └── landscape.json

packages/schema/src/schema.ts              # MODIFY — add building-block schema exports

agents/                                     # NEW — analyzer prompts (prose, held to fragment contract)
├── essence-analyzer.md
├── success-analyzer.md
└── landscape-analyzer.md

skills/grasp/SKILL.md                       # NEW — orchestrator (wizard + phases)

.claude-plugin/plugin.json                  # NEW — plugin manifest
```

---

## Task 1: Scaffold `packages/pipeline` workspace

**Files:**
- Create: `packages/pipeline/package.json`
- Create: `packages/pipeline/tsconfig.json`
- Create: `packages/pipeline/vitest.config.ts`
- Create: `packages/pipeline/src/index.ts`
- Test: `packages/pipeline/src/__tests__/smoke.test.ts`

- [ ] **Step 1: Write the package manifest and configs**

`packages/pipeline/package.json`:

```json
{
  "name": "@grasp/pipeline",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "bin": { "grasp-assemble": "src/cli.ts" },
  "scripts": {
    "assemble": "tsx src/cli.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@grasp/schema": "*",
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

`packages/pipeline/tsconfig.json` (mirrors `packages/schema/tsconfig.json`):

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

`packages/pipeline/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 2: Write the index with a version constant**

`packages/pipeline/src/index.ts`:

```ts
export const PIPELINE_VERSION = "0.1.0";
```

- [ ] **Step 3: Write the failing smoke test**

`packages/pipeline/src/__tests__/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { PIPELINE_VERSION } from "../index";
import { SCHEMA_VERSION } from "@grasp/schema";

describe("pipeline package", () => {
  it("exposes its version", () => {
    expect(PIPELINE_VERSION).toBe("0.1.0");
  });

  it("can import the schema workspace", () => {
    expect(SCHEMA_VERSION).toBe("0.1.0");
  });
});
```

- [ ] **Step 4: Install so npm links the new workspace**

Run: `npm install`
Expected: completes without error; `@grasp/pipeline` and its `@grasp/schema` dependency are linked into the workspace.

- [ ] **Step 5: Run the smoke test**

Run: `npm test --workspace @grasp/pipeline`
Expected: PASS (2 tests).

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck --workspace @grasp/pipeline`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/pipeline package.json package-lock.json
git commit -m "chore(pipeline): scaffold @grasp/pipeline workspace"
```

---

## Task 2: Fragment schemas

**Files:**
- Modify: `packages/schema/src/schema.ts` (add building-block exports at end of file)
- Create: `packages/pipeline/src/fragments.ts`
- Test: `packages/pipeline/src/__tests__/fragments.test.ts`

- [ ] **Step 1: Export the building-block schemas from `@grasp/schema`**

Append to the end of `packages/schema/src/schema.ts` (after the `export type BriefDoc` line). These are additive re-export aliases of the existing internal `const` schemas — no existing code changes:

```ts
export {
  ConceptNode as ConceptNodeSchema,
  ConceptEdge as ConceptEdgeSchema,
  LandscapeNode as LandscapeNodeSchema,
  LandscapeEdge as LandscapeEdgeSchema,
  Evidence as EvidenceSchema,
  Meta as MetaSchema,
};
```

(`packages/schema/src/index.ts` already does `export * from "./schema"`, so these propagate automatically.)

- [ ] **Step 2: Confirm the schema package still passes**

Run: `npm test --workspace @grasp/schema && npm run typecheck --workspace @grasp/schema`
Expected: all existing schema tests PASS, no type errors.

- [ ] **Step 3: Write the failing fragment-schema tests**

`packages/pipeline/src/__tests__/fragments.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  EssenceFragmentSchema,
  SuccessFragmentSchema,
  LandscapeFragmentSchema,
} from "../fragments";

const validEssence = {
  idea: "Turn a repo into a knowledge graph.",
  problem: "Onboarding into a codebase is slow.",
  how: "LLM agents emit a validated JSON graph.",
  conceptGraph: {
    nodes: [
      { id: "idea1", type: "idea", label: "Repo as a graph" },
      { id: "p1", type: "problem", label: "Hard to onboard" },
    ],
    edges: [{ id: "ce1", source: "idea1", target: "p1", type: "addresses" }],
  },
};

describe("EssenceFragmentSchema", () => {
  it("accepts a valid essence fragment and fills defaults", () => {
    const parsed = EssenceFragmentSchema.parse(validEssence);
    expect(parsed.evidence).toEqual([]);
    expect(parsed.briefEvidence).toEqual({});
    expect(parsed.conceptGraph.nodes[0].detail).toBe("");
    expect(parsed.conceptGraph.nodes[0].evidenceIds).toEqual([]);
  });

  it("rejects a fragment missing the 'how' prose", () => {
    const { how, ...rest } = validEssence;
    expect(EssenceFragmentSchema.safeParse(rest).success).toBe(false);
  });
});

describe("SuccessFragmentSchema", () => {
  it("accepts why + takeaway", () => {
    const parsed = SuccessFragmentSchema.parse({
      why: "One command, polished output.",
      takeaway: "Worth it for large repos.",
    });
    expect(parsed.evidence).toEqual([]);
    expect(parsed.briefEvidence).toEqual({});
  });

  it("rejects an empty 'why'", () => {
    expect(
      SuccessFragmentSchema.safeParse({ why: "", takeaway: "x" }).success,
    ).toBe(false);
  });
});

describe("LandscapeFragmentSchema", () => {
  it("accepts a self-only landscape graph", () => {
    const parsed = LandscapeFragmentSchema.parse({
      landscapeGraph: {
        nodes: [{ id: "self", type: "self", name: "Repo" }],
        edges: [],
      },
    });
    expect(parsed.evidence).toEqual([]);
    expect(parsed.landscapeGraph.nodes[0].evidenceIds).toEqual([]);
  });
});
```

- [ ] **Step 4: Run to verify the tests fail**

Run: `npm test --workspace @grasp/pipeline`
Expected: FAIL with "Cannot find module '../fragments'".

- [ ] **Step 5: Implement the fragment schemas**

`packages/pipeline/src/fragments.ts`:

```ts
import { z } from "zod";
import {
  ConceptNodeSchema,
  ConceptEdgeSchema,
  LandscapeNodeSchema,
  LandscapeEdgeSchema,
  EvidenceSchema,
} from "@grasp/schema";

/**
 * Each analyzer agent emits one fragment. Fragment schemas validate SHAPE only —
 * referential integrity (evidence resolution, exactly-one-idea, exactly-one-self)
 * is enforced once on the assembled BriefDoc by validateBrief, because a fragment
 * validated alone cannot resolve evidence ids introduced by a sibling fragment.
 */

export const EssenceFragmentSchema = z.object({
  idea: z.string().min(1),
  problem: z.string().min(1),
  how: z.string().min(1),
  conceptGraph: z.object({
    nodes: z.array(ConceptNodeSchema),
    edges: z.array(ConceptEdgeSchema),
  }),
  evidence: z.array(EvidenceSchema).default([]),
  briefEvidence: z
    .object({
      idea: z.array(z.string()).optional(),
      problem: z.array(z.string()).optional(),
      how: z.array(z.string()).optional(),
    })
    .default({}),
});

export const SuccessFragmentSchema = z.object({
  why: z.string().min(1),
  takeaway: z.string().min(1),
  evidence: z.array(EvidenceSchema).default([]),
  briefEvidence: z
    .object({
      why: z.array(z.string()).optional(),
      takeaway: z.array(z.string()).optional(),
    })
    .default({}),
});

export const LandscapeFragmentSchema = z.object({
  landscapeGraph: z.object({
    nodes: z.array(LandscapeNodeSchema),
    edges: z.array(LandscapeEdgeSchema),
  }),
  evidence: z.array(EvidenceSchema).default([]),
});

export type EssenceFragment = z.infer<typeof EssenceFragmentSchema>;
export type SuccessFragment = z.infer<typeof SuccessFragmentSchema>;
export type LandscapeFragment = z.infer<typeof LandscapeFragmentSchema>;
```

- [ ] **Step 6: Run the tests**

Run: `npm test --workspace @grasp/pipeline`
Expected: PASS (smoke + fragment tests).

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck --workspace @grasp/pipeline`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/schema/src/schema.ts packages/pipeline/src/fragments.ts packages/pipeline/src/__tests__/fragments.test.ts
git commit -m "feat(pipeline): per-agent fragment schemas; export schema building blocks"
```

---

## Task 3: `assemble()` — merge fragments into a valid `BriefDoc`

**Files:**
- Create: `packages/pipeline/src/assemble.ts`
- Modify: `packages/pipeline/src/index.ts` (export assemble)
- Create fixtures: `packages/pipeline/src/__tests__/fixtures/{meta,essence,success,landscape}.json`
- Test: `packages/pipeline/src/__tests__/assemble.test.ts`

- [ ] **Step 1: Create the golden fragment fixtures**

These are the golden `sample-brief.json` split along agent ownership; assembling them must reconstruct that file exactly.

`packages/pipeline/src/__tests__/fixtures/meta.json`:

```json
{
  "repo": "Lum1104/Understand-Anything",
  "url": "https://github.com/Lum1104/Understand-Anything",
  "analyzedAt": "2026-06-08T12:00:00Z",
  "depth": "skim",
  "broadness": "web",
  "signals": { "stars": 1200, "lastCommit": "2026-06-01", "language": "TypeScript" }
}
```

`packages/pipeline/src/__tests__/fixtures/essence.json`:

```json
{
  "idea": "Turn any codebase into an interactive knowledge graph so newcomers can grasp its architecture without reading every file.",
  "problem": "Onboarding into an unfamiliar codebase is slow and intimidating; engineers must reverse-engineer structure from scattered files.",
  "how": "LLM sub-agents analyze files in batches and emit a validated JSON graph; a deterministic core validates and fingerprints it; a React dashboard renders it with layered layout.",
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
  "evidence": [
    { "id": "ev1", "claim": "Ships an interactive web dashboard", "source": "README", "url": "https://github.com/Lum1104/Understand-Anything", "verified": true }
  ],
  "briefEvidence": {}
}
```

`packages/pipeline/src/__tests__/fixtures/success.json`:

```json
{
  "why": "It packages a heavy LLM analysis pipeline behind a one-command plugin and renders results in a polished dashboard, lowering the effort to near zero.",
  "takeaway": "Worth it if you regularly onboard onto large or unfamiliar repos.",
  "evidence": [],
  "briefEvidence": { "why": ["ev1"] }
}
```

`packages/pipeline/src/__tests__/fixtures/landscape.json`:

```json
{
  "landscapeGraph": {
    "nodes": [
      { "id": "self1", "type": "self", "name": "Understand-Anything", "url": "https://github.com/Lum1104/Understand-Anything", "stars": 1200, "category": "cat1", "evidenceIds": [] },
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
    { "id": "ev2", "claim": "Cody has 3k+ GitHub stars", "source": "GitHub", "url": "https://github.com/sourcegraph/cody", "verified": true }
  ]
}
```

- [ ] **Step 2: Write the failing assemble tests**

`packages/pipeline/src/__tests__/assemble.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateBrief } from "@grasp/schema";
import { assemble } from "../assemble";
import goldenSample from "@grasp/schema/sample-brief.json";
import meta from "./fixtures/meta.json";
import essence from "./fixtures/essence.json";
import success from "./fixtures/success.json";
import landscape from "./fixtures/landscape.json";

describe("assemble", () => {
  it("reconstructs the golden sample from its three fragments", () => {
    const result = assemble({ meta, essence, success, landscape });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Strong contract check: the three fragments reassemble the exact golden brief.
    // If this reveals only key-ordering/default differences, fix the fixtures —
    // the fragments are the source of truth for what each agent must emit.
    expect(result.doc).toEqual(goldenSample);
  });

  it("produces a brief that passes the full validator", () => {
    const result = assemble({ meta, essence, success, landscape });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(validateBrief(result.doc).ok).toBe(true);
  });

  it("resolves cross-fragment evidence (success.why cites ev1, introduced by essence)", () => {
    const result = assemble({ meta, essence, success, landscape });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doc.brief.evidence).toEqual({ why: ["ev1"] });
    expect(result.doc.evidence.map((e) => e.id)).toEqual(["ev1", "ev2"]);
  });

  it("synthesizes a self-only landscape when offline (no landscape fragment)", () => {
    const result = assemble({ meta, essence, success });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const land = result.doc.landscapeGraph;
    expect(land.nodes).toHaveLength(1);
    expect(land.nodes[0].type).toBe("self");
    expect(land.nodes[0].name).toBe("Lum1104/Understand-Anything");
    expect(land.edges).toEqual([]);
    expect(validateBrief(result.doc).ok).toBe(true);
  });

  it("reports prefixed errors for an invalid meta", () => {
    const { repo, ...badMeta } = meta as Record<string, unknown>;
    const result = assemble({ meta: badMeta, essence, success, landscape });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.startsWith("meta.repo"))).toBe(true);
  });

  it("reports prefixed errors for an invalid fragment", () => {
    const badEssence = { ...essence, how: "" };
    const result = assemble({ meta, essence: badEssence, success, landscape });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.startsWith("essence.how"))).toBe(true);
  });

  it("rejects conflicting evidence ids across fragments", () => {
    const clashEssence = {
      ...essence,
      evidence: [{ id: "dup", claim: "A", source: "README", verified: true }],
    };
    const clashSuccess = {
      ...success,
      evidence: [{ id: "dup", claim: "B (different)", source: "GitHub", verified: false }],
      briefEvidence: {},
    };
    const result = assemble({ meta, essence: clashEssence, success: clashSuccess, landscape });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.includes("conflicting"))).toBe(true);
  });
});
```

- [ ] **Step 3: Run to verify the tests fail**

Run: `npm test --workspace @grasp/pipeline`
Expected: FAIL with "Cannot find module '../assemble'".

- [ ] **Step 4: Implement `assemble`**

`packages/pipeline/src/assemble.ts`:

```ts
import { z } from "zod";
import { MetaSchema, EvidenceSchema, validateBrief, type BriefDoc } from "@grasp/schema";
import {
  EssenceFragmentSchema,
  SuccessFragmentSchema,
  LandscapeFragmentSchema,
} from "./fragments";

type Meta = z.infer<typeof MetaSchema>;
type Evidence = z.infer<typeof EvidenceSchema>;

export interface AssembleInput {
  meta: unknown;
  essence: unknown;
  success: unknown;
  /** Omit (or pass undefined/null) for offline runs — a self-only landscape is synthesized. */
  landscape?: unknown;
}

export type AssembleResult =
  | { ok: true; doc: BriefDoc }
  | { ok: false; errors: string[] };

function collect(
  prefix: string,
  result: z.SafeParseReturnType<unknown, unknown>,
  errors: string[],
): void {
  if (result.success) return;
  for (const issue of result.error.issues) {
    const path = issue.path.join(".") || "(root)";
    errors.push(`${prefix}.${path}: ${issue.message}`);
  }
}

function mergeBriefEvidence(
  ...maps: Record<string, string[] | undefined>[]
): Record<string, string[]> | undefined {
  const merged: Record<string, string[]> = {};
  for (const map of maps) {
    for (const [key, ids] of Object.entries(map)) {
      if (ids && ids.length > 0) merged[key] = ids;
    }
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function synthesizeSelfLandscape(meta: Meta) {
  return {
    nodes: [
      { id: "self", type: "self" as const, name: meta.repo, url: meta.url, evidenceIds: [] },
    ],
    edges: [],
  };
}

export function assemble(input: AssembleInput): AssembleResult {
  const errors: string[] = [];

  const metaParsed = MetaSchema.safeParse(input.meta);
  collect("meta", metaParsed, errors);
  const essParsed = EssenceFragmentSchema.safeParse(input.essence);
  collect("essence", essParsed, errors);
  const sucParsed = SuccessFragmentSchema.safeParse(input.success);
  collect("success", sucParsed, errors);

  const hasLandscape = input.landscape !== undefined && input.landscape !== null;
  const landParsed = hasLandscape ? LandscapeFragmentSchema.safeParse(input.landscape) : null;
  if (landParsed) collect("landscape", landParsed, errors);

  if (errors.length > 0) return { ok: false, errors };

  const meta = metaParsed.data!;
  const essence = essParsed.data!;
  const success = sucParsed.data!;
  const landscape = landParsed && landParsed.success ? landParsed.data : null;

  // Merge evidence by id; an id reused with different content is an authoring bug.
  const evidenceById = new Map<string, Evidence>();
  const conflicts: string[] = [];
  const addEvidence = (list: Evidence[]) => {
    for (const e of list) {
      const existing = evidenceById.get(e.id);
      if (existing) {
        if (JSON.stringify(existing) !== JSON.stringify(e)) {
          conflicts.push(`evidence: duplicate id '${e.id}' with conflicting content`);
        }
        continue;
      }
      evidenceById.set(e.id, e);
    }
  };
  addEvidence(essence.evidence);
  addEvidence(success.evidence);
  if (landscape) addEvidence(landscape.evidence);
  if (conflicts.length > 0) return { ok: false, errors: conflicts };

  const briefEvidence = mergeBriefEvidence(essence.briefEvidence, success.briefEvidence);

  const doc = {
    meta,
    brief: {
      idea: essence.idea,
      problem: essence.problem,
      why: success.why,
      how: essence.how,
      takeaway: success.takeaway,
      updatedAt: {
        essence: meta.analyzedAt,
        success: meta.analyzedAt,
        landscape: meta.analyzedAt,
      },
      ...(briefEvidence ? { evidence: briefEvidence } : {}),
    },
    conceptGraph: essence.conceptGraph,
    landscapeGraph: landscape ? landscape.landscapeGraph : synthesizeSelfLandscape(meta),
    evidence: [...evidenceById.values()],
  };

  const validated = validateBrief(doc);
  if (!validated.ok || !validated.data) {
    return { ok: false, errors: validated.errors.map((e) => `assembled brief: ${e}`) };
  }
  return { ok: true, doc: validated.data };
}
```

- [ ] **Step 5: Export assemble from the index**

`packages/pipeline/src/index.ts` — add below the version line:

```ts
export * from "./fragments";
export * from "./assemble";
```

- [ ] **Step 6: Run the tests**

Run: `npm test --workspace @grasp/pipeline`
Expected: PASS (smoke + fragments + assemble).

Note: if the `toEqual(goldenSample)` assertion fails, read the diff carefully — it means a fixture diverged from `sample-brief.json` (the fragments are wrong), not that `assemble` is wrong. Fix the fixture.

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck --workspace @grasp/pipeline`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/pipeline/src/assemble.ts packages/pipeline/src/index.ts packages/pipeline/src/__tests__/assemble.test.ts packages/pipeline/src/__tests__/fixtures
git commit -m "feat(pipeline): assemble three agent fragments into a validated repo-brief"
```

---

## Task 4: `render()` — write the brief beside the vendored dashboard

**Files:**
- Create: `packages/pipeline/src/render.ts`
- Modify: `packages/pipeline/src/index.ts` (export render)
- Test: `packages/pipeline/src/__tests__/render.test.ts`

- [ ] **Step 1: Write the failing render test**

`packages/pipeline/src/__tests__/render.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateBrief } from "@grasp/schema";
import goldenSample from "@grasp/schema/sample-brief.json";
import { render } from "../render";

const doc = validateBrief(goldenSample).data!;

let work: string;
let distDir: string;
let targetDir: string;

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), "grasp-render-"));
  distDir = join(work, "dist");
  targetDir = join(work, "repo");
  // Fake a vendored dashboard build.
  mkdirSync(join(distDir, "assets"), { recursive: true });
  writeFileSync(join(distDir, "index.html"), "<!doctype html><div id=root></div>");
  writeFileSync(join(distDir, "assets", "app.js"), "console.log('app')");
  mkdirSync(targetDir, { recursive: true });
});

afterEach(() => {
  rmSync(work, { recursive: true, force: true });
});

describe("render", () => {
  it("copies the dist and writes a valid brief beside index.html", () => {
    const out = render({ doc, targetDir, distDir });

    expect(out.outputDir).toBe(join(targetDir, ".grasp", "dashboard"));
    expect(existsSync(out.indexPath)).toBe(true);
    expect(existsSync(join(out.outputDir, "assets", "app.js"))).toBe(true);
    expect(existsSync(out.briefPath)).toBe(true);

    const written = JSON.parse(readFileSync(out.briefPath, "utf8"));
    expect(validateBrief(written).ok).toBe(true);
    expect(written).toEqual(doc);
  });

  it("throws a clear error when the dist is missing", () => {
    expect(() => render({ doc, targetDir, distDir: join(work, "nope") })).toThrow(
      /dist not found/,
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test --workspace @grasp/pipeline`
Expected: FAIL with "Cannot find module '../render'".

- [ ] **Step 3: Implement `render`**

`packages/pipeline/src/render.ts`:

```ts
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BriefDoc } from "@grasp/schema";

export interface RenderInput {
  doc: BriefDoc;
  /** Repo root being analyzed; output goes to <targetDir>/.grasp/dashboard. */
  targetDir: string;
  /** The vendored dashboard build (packages/dashboard/dist). */
  distDir: string;
}

export interface RenderResult {
  outputDir: string;
  briefPath: string;
  indexPath: string;
}

/**
 * Writes the self-contained report: copies the pre-built dashboard beside the
 * brief so the page can fetch ./repo-brief.json over file://. Never builds anything.
 */
export function render({ doc, targetDir, distDir }: RenderInput): RenderResult {
  if (!existsSync(distDir)) {
    throw new Error(
      `dashboard dist not found at ${distDir} — build it first: npm run build --workspace @grasp/dashboard`,
    );
  }
  const outputDir = join(targetDir, ".grasp", "dashboard");
  mkdirSync(outputDir, { recursive: true });
  cpSync(distDir, outputDir, { recursive: true });

  const briefPath = join(outputDir, "repo-brief.json");
  writeFileSync(briefPath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");

  return { outputDir, briefPath, indexPath: join(outputDir, "index.html") };
}
```

- [ ] **Step 4: Export render from the index**

`packages/pipeline/src/index.ts` — add:

```ts
export * from "./render";
```

- [ ] **Step 5: Run the tests**

Run: `npm test --workspace @grasp/pipeline`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck --workspace @grasp/pipeline`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/pipeline/src/render.ts packages/pipeline/src/index.ts packages/pipeline/src/__tests__/render.test.ts
git commit -m "feat(pipeline): render brief + vendored dashboard into .grasp/dashboard"
```

---

## Task 5: CLI — `grasp-assemble` (assemble + render from a fragments dir)

**Files:**
- Create: `packages/pipeline/src/cli-run.ts` (testable logic)
- Create: `packages/pipeline/src/cli.ts` (bin wrapper)
- Test: `packages/pipeline/src/__tests__/cli.test.ts`

- [ ] **Step 1: Write the failing CLI test**

`packages/pipeline/src/__tests__/cli.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  cpSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateBrief } from "@grasp/schema";
import { runCli } from "../cli-run";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(here, "fixtures");

let work: string;
let fragmentsDir: string;
let distDir: string;
let targetDir: string;

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), "grasp-cli-"));
  fragmentsDir = join(work, "fragments");
  distDir = join(work, "dist");
  targetDir = join(work, "repo");
  // Copy golden fragments into a working fragments dir.
  cpSync(fixturesDir, fragmentsDir, { recursive: true });
  // Fake a vendored dashboard build.
  mkdirSync(distDir, { recursive: true });
  writeFileSync(join(distDir, "index.html"), "<!doctype html>");
  mkdirSync(targetDir, { recursive: true });
});

afterEach(() => {
  rmSync(work, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("runCli", () => {
  it("exits 0 and renders a valid brief for good fragments", () => {
    const code = runCli([fragmentsDir, "--target", targetDir, "--dist", distDir]);
    expect(code).toBe(0);
    const briefPath = join(targetDir, ".grasp", "dashboard", "repo-brief.json");
    expect(existsSync(briefPath)).toBe(true);
    expect(validateBrief(JSON.parse(readFileSync(briefPath, "utf8"))).ok).toBe(true);
  });

  it("works offline when landscape.json is absent", () => {
    rmSync(join(fragmentsDir, "landscape.json"));
    const code = runCli([fragmentsDir, "--target", targetDir, "--dist", distDir]);
    expect(code).toBe(0);
    const brief = JSON.parse(
      readFileSync(join(targetDir, ".grasp", "dashboard", "repo-brief.json"), "utf8"),
    );
    expect(brief.landscapeGraph.nodes).toHaveLength(1);
  });

  it("exits 2 on missing required flags", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(runCli([fragmentsDir, "--target", targetDir])).toBe(2);
  });

  it("exits 1 when a fragment is invalid", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    writeFileSync(join(fragmentsDir, "success.json"), JSON.stringify({ why: "", takeaway: "" }));
    expect(runCli([fragmentsDir, "--target", targetDir, "--dist", distDir])).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test --workspace @grasp/pipeline`
Expected: FAIL with "Cannot find module '../cli-run'".

- [ ] **Step 3: Implement the CLI logic**

`packages/pipeline/src/cli-run.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { assemble } from "./assemble";
import { render } from "./render";

interface Args {
  fragmentsDir?: string;
  target?: string;
  dist?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--target") args.target = argv[++i];
    else if (a === "--dist") args.dist = argv[++i];
    else positional.push(a);
  }
  if (positional.length > 0) args.fragmentsDir = positional[0];
  return args;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Returns a process exit code: 0 ok, 1 assembly/validation failed, 2 usage/IO error. */
export function runCli(argv: string[]): number {
  const { fragmentsDir, target, dist } = parseArgs(argv);
  if (!fragmentsDir || !target || !dist) {
    console.error(
      "usage: grasp-assemble <fragmentsDir> --target <repoDir> --dist <dashboardDist>",
    );
    return 2;
  }

  let meta: unknown;
  let essence: unknown;
  let success: unknown;
  let landscape: unknown;
  try {
    meta = readJson(join(fragmentsDir, "meta.json"));
    essence = readJson(join(fragmentsDir, "essence.json"));
    success = readJson(join(fragmentsDir, "success.json"));
    const landscapePath = join(fragmentsDir, "landscape.json");
    landscape = existsSync(landscapePath) ? readJson(landscapePath) : undefined;
  } catch (err) {
    console.error(`Cannot read fragments in ${fragmentsDir}: ${(err as Error).message}`);
    return 2;
  }

  const result = assemble({ meta, essence, success, landscape });
  if (!result.ok) {
    console.error("✗ Could not assemble a valid repo-brief:");
    for (const e of result.errors) console.error(`  - ${e}`);
    return 1;
  }

  try {
    const { briefPath, indexPath } = render({ doc: result.doc, targetDir: target, distDir: dist });
    console.error(`✓ Wrote ${briefPath}`);
    console.log(indexPath);
    return 0;
  } catch (err) {
    console.error(`Render failed: ${(err as Error).message}`);
    return 2;
  }
}
```

(The brief's path goes to stderr and the openable `index.html` path to stdout, so a caller can `open "$(grasp-assemble …)"`.)

- [ ] **Step 4: Implement the bin wrapper**

`packages/pipeline/src/cli.ts`:

```ts
#!/usr/bin/env tsx
import { runCli } from "./cli-run";

process.exit(runCli(process.argv.slice(2)));
```

- [ ] **Step 5: Run the tests**

Run: `npm test --workspace @grasp/pipeline`
Expected: PASS.

- [ ] **Step 6: Smoke-run the CLI by hand**

Run:
```bash
npx tsx packages/pipeline/src/cli.ts packages/pipeline/src/__tests__/fixtures \
  --target /tmp/grasp-smoke --dist packages/pipeline/src/__tests__/fixtures 2>/dev/null || true
```
Expected: exits non-zero only because the fixtures dir is not a real dashboard `dist` (no `index.html`); the point is to confirm the CLI runs end-to-end without a crash. (The automated test already covers the success path with a fake dist.) Then clean up: `rm -rf /tmp/grasp-smoke`.

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck --workspace @grasp/pipeline`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/pipeline/src/cli-run.ts packages/pipeline/src/cli.ts packages/pipeline/src/__tests__/cli.test.ts
git commit -m "feat(pipeline): grasp-assemble CLI (assemble + render from a fragments dir)"
```

---

## Task 6: Analyzer agent prompts

**Files:**
- Create: `agents/essence-analyzer.md`
- Create: `agents/success-analyzer.md`
- Create: `agents/landscape-analyzer.md`
- Test: `packages/pipeline/src/__tests__/agent-contracts.test.ts`

Each agent doc embeds a worked example fragment in a fenced ```json block immediately preceded by an `<!-- example -->` marker. The test below extracts that block and validates it against the matching fragment schema, so the prose can never drift from the executable contract.

- [ ] **Step 1: Write the failing agent-contract test**

`packages/pipeline/src/__tests__/agent-contracts.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { z } from "zod";
import {
  EssenceFragmentSchema,
  SuccessFragmentSchema,
  LandscapeFragmentSchema,
} from "../fragments";

const here = dirname(fileURLToPath(import.meta.url));
const agentsDir = resolve(here, "../../../../agents");

function extractExample(file: string): unknown {
  const md = readFileSync(resolve(agentsDir, file), "utf8");
  const m = md.match(/<!--\s*example\s*-->\s*```json\s*([\s\S]*?)```/);
  if (!m) throw new Error(`no <!-- example --> json block in ${file}`);
  return JSON.parse(m[1]);
}

const cases: [string, z.ZodTypeAny][] = [
  ["essence-analyzer.md", EssenceFragmentSchema],
  ["success-analyzer.md", SuccessFragmentSchema],
  ["landscape-analyzer.md", LandscapeFragmentSchema],
];

describe("agent output contracts", () => {
  for (const [file, schema] of cases) {
    it(`${file} embeds an example that matches its fragment schema`, () => {
      const example = extractExample(file);
      const result = schema.safeParse(example);
      expect(result.success).toBe(true);
    });
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test --workspace @grasp/pipeline`
Expected: FAIL — the `agents/` directory and files do not exist yet (`extractExample` throws / readFileSync ENOENT).

- [ ] **Step 3: Write `agents/essence-analyzer.md`**

````markdown
---
name: essence-analyzer
description: Reads a repository's README, docs, and (per depth) core code to extract its core idea, the problem it addresses, and how it works — emitting the concept graph plus the idea/problem/how prose.
tools: Read, Grep, Glob, WebFetch
---

You are the **essence analyzer** for `/grasp`. You answer three of the five
strategic questions from *inside* the repo: **what is the main idea**, **what
problem does it address**, and **how does it work**. You also build the inward
**concept graph**.

## Inputs you receive
- The repo's README and any `docs/` content.
- Manifests (`package.json`, `pyproject.toml`, etc.) and the file tree.
- At `depth: skim` or `deep`, the entry points / core files the orchestrator gathered.

## What you must output
Return **only** a JSON object (no prose around it) matching the EssenceFragment
contract:

- `idea` — 1–2 sentence thesis.
- `problem` — the pain it removes + who has it.
- `how` — the mechanism in plain language.
- `conceptGraph.nodes` — typed nodes. Use exactly one `idea` node (the root).
  Types: `problem`, `idea`, `mechanism`, `outcome`, `feature`. Each node:
  `{ id, type, label, detail?, evidenceIds? }`.
- `conceptGraph.edges` — `{ id, source, target, type }`, type one of
  `addresses` (idea→problem), `composedOf` (idea→mechanism),
  `enables` (mechanism→outcome), `produces` (mechanism→feature).
- `evidence` — optional; sources you introduce, each
  `{ id, claim, source, url?, verified }`. Set `verified: false` for anything you
  infer rather than read directly.
- `briefEvidence` — optional; which evidence ids back each prose field, e.g.
  `{ "idea": ["e1"] }`.

## Grounding rules
- Prefer claims you can point to in the README/docs/code. Mark inferred claims
  `verified: false`.
- Exactly one `idea` node. Every edge endpoint must be a node `id` you defined.
- Do not invent a competitive landscape — that is the landscape analyzer's job.

## Example output

<!-- example -->
```json
{
  "idea": "Turn any codebase into an interactive knowledge graph so newcomers can grasp its architecture without reading every file.",
  "problem": "Onboarding into an unfamiliar codebase is slow and intimidating; engineers must reverse-engineer structure from scattered files.",
  "how": "LLM sub-agents analyze files in batches and emit a validated JSON graph; a deterministic core validates and fingerprints it; a React dashboard renders it.",
  "conceptGraph": {
    "nodes": [
      { "id": "p1", "type": "problem", "label": "Codebases are hard to onboard into", "detail": "Structure is implicit and spread across many files." },
      { "id": "idea1", "type": "idea", "label": "Repo as an interactive knowledge graph", "detail": "Nodes are files/symbols; edges are imports/calls." },
      { "id": "m1", "type": "mechanism", "label": "LLM agents emit a validated JSON graph", "detail": "Batched file analysis by sub-agents." },
      { "id": "o1", "type": "outcome", "label": "Interactive architecture dashboard", "detail": "Layered, zoomable graph view.", "evidenceIds": ["ev1"] }
    ],
    "edges": [
      { "id": "ce1", "source": "idea1", "target": "p1", "type": "addresses" },
      { "id": "ce2", "source": "idea1", "target": "m1", "type": "composedOf" },
      { "id": "ce3", "source": "m1", "target": "o1", "type": "enables" }
    ]
  },
  "evidence": [
    { "id": "ev1", "claim": "Ships an interactive web dashboard", "source": "README", "url": "https://github.com/Lum1104/Understand-Anything", "verified": true }
  ],
  "briefEvidence": {}
}
```
````

- [ ] **Step 4: Write `agents/success-analyzer.md`**

````markdown
---
name: success-analyzer
description: Judges why a repository succeeds and whether it is worth caring about, grounding the verdict in adoption signals — emitting the why + takeaway prose and the evidence that backs them.
tools: Read, Grep, Glob, WebFetch
---

You are the **success analyzer** for `/grasp`. You answer **why does it
succeed** and deliver the one-line **takeaway** verdict. Your judgments must be
grounded in evidence the orchestrator gathered (stars, activity, issues, notable
adopters) — not vibes.

## Inputs you receive
- Repo signals: stars, last commit, open/closed issue counts, language.
- README claims about adoption / users.
- At `broadness: web`, search results about the project's reception.

## What you must output
Return **only** a JSON object matching the SuccessFragment contract:

- `why` — why it succeeds, in prose, grounded in `evidence`.
- `takeaway` — a single "should I care?" line.
- `evidence` — sources you introduce: `{ id, claim, source, url?, verified }`.
  `verified: false` for anything inferred (e.g. offline mode, no live signal).
- `briefEvidence` — which evidence ids back `why` / `takeaway`, e.g.
  `{ "why": ["s1"] }`. You may cite an evidence id introduced by another analyzer.

## Grounding rules
- Every strong claim in `why` should map to an evidence id.
- If a signal is unavailable, say so and mark related evidence `verified: false`.
- Keep `takeaway` to one sentence — it is the header verdict.

## Example output

<!-- example -->
```json
{
  "why": "It packages a heavy LLM analysis pipeline behind a one-command plugin and renders results in a polished dashboard, lowering the effort to near zero.",
  "takeaway": "Worth it if you regularly onboard onto large or unfamiliar repos.",
  "evidence": [
    { "id": "s1", "claim": "1,200+ GitHub stars indicate real adoption", "source": "GitHub", "url": "https://github.com/Lum1104/Understand-Anything", "verified": true }
  ],
  "briefEvidence": { "why": ["s1"] }
}
```
````

- [ ] **Step 5: Write `agents/landscape-analyzer.md`**

````markdown
---
name: landscape-analyzer
description: Surveys the outward competitive landscape — finds similar/competing repos, places the analyzed repo among them, and emits the landscape graph. Skipped in offline mode.
tools: WebFetch, WebSearch, Read
---

You are the **landscape analyzer** for `/grasp`. You answer **are there similar
repos, and how is this different**. You build the outward **landscape graph**.
You run only at `broadness: web`; offline runs skip you entirely.

## Inputs you receive
- The repo's name, one-liner, and idea (from the essence analyzer / README).
- Web search results for "alternatives to X", "X vs", category terms.

## What you must output
Return **only** a JSON object matching the LandscapeFragment contract:

- `landscapeGraph.nodes`:
  - exactly one `self` node: `{ id, type: "self", name, url?, stars?, category? }`.
  - `alternative` nodes: `{ id, type: "alternative", name, url, stars?, oneLiner?,
    similarity (0–1), differentiator?, category? }`. `name` and `url` are required.
  - `category` nodes: `{ id, type: "category", label }`. `label` is required.
- `landscapeGraph.edges` — `{ id, source, target, type }`, type one of
  `competesWith`, `sharesApproach`, `alternativeTo`.
- `evidence` — sources for your claims (stars, "is an alternative"), each
  `{ id, claim, source, url?, verified }`.

## Grounding rules
- Only list real, locatable repos with URLs. If you cannot verify a competitor,
  omit it rather than inventing one.
- `similarity` is your honest 0–1 estimate; `differentiator` says how `self` differs.
- Every edge endpoint must be a node `id` you defined.

## Example output

<!-- example -->
```json
{
  "landscapeGraph": {
    "nodes": [
      { "id": "self1", "type": "self", "name": "Understand-Anything", "url": "https://github.com/Lum1104/Understand-Anything", "stars": 1200, "category": "cat1" },
      { "id": "alt1", "type": "alternative", "name": "Sourcegraph Cody", "url": "https://github.com/sourcegraph/cody", "stars": 3000, "oneLiner": "AI coding assistant with codebase context.", "similarity": 0.55, "differentiator": "Commercial, IDE-embedded, not a static graph.", "category": "cat1", "evidenceIds": ["ev2"] },
      { "id": "cat1", "type": "category", "label": "Code comprehension tools" }
    ],
    "edges": [
      { "id": "le1", "source": "alt1", "target": "self1", "type": "alternativeTo" }
    ]
  },
  "evidence": [
    { "id": "ev2", "claim": "Cody has 3k+ GitHub stars", "source": "GitHub", "url": "https://github.com/sourcegraph/cody", "verified": true }
  ]
}
```
````

- [ ] **Step 6: Run the tests**

Run: `npm test --workspace @grasp/pipeline`
Expected: PASS — all three embedded examples validate against their fragment schemas.

- [ ] **Step 7: Commit**

```bash
git add agents packages/pipeline/src/__tests__/agent-contracts.test.ts
git commit -m "feat(agents): essence/success/landscape analyzer prompts with contract-checked examples"
```

---

## Task 7: `skills/grasp/SKILL.md` orchestrator

**Files:**
- Create: `skills/grasp/SKILL.md`
- Test: `packages/pipeline/src/__tests__/skill-contract.test.ts`

- [ ] **Step 1: Write the failing skill-contract test**

`packages/pipeline/src/__tests__/skill-contract.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const skillPath = resolve(here, "../../../../skills/grasp/SKILL.md");

describe("SKILL.md orchestrator contract", () => {
  const md = readFileSync(skillPath, "utf8");

  it("declares the skill name in frontmatter", () => {
    expect(md).toMatch(/^---[\s\S]*?\nname:\s*grasp\b/);
  });

  it("references the real moving parts (drift guard)", () => {
    for (const token of [
      "grasp-assemble",
      "essence-analyzer",
      "success-analyzer",
      "landscape-analyzer",
      "depth",
      "broadness",
      ".grasp",
    ]) {
      expect(md).toContain(token);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test --workspace @grasp/pipeline`
Expected: FAIL — `skills/grasp/SKILL.md` does not exist (ENOENT).

- [ ] **Step 3: Write `skills/grasp/SKILL.md`**

````markdown
---
name: grasp
description: Use when the user wants to understand a repository strategically (not technically) — its main idea, the problem it solves, why it succeeds, how it works, and similar projects. Produces an interactive HTML brief with two graphs from a local path or public GitHub URL.
---

# `/grasp` — Strategic Repo Understanding

Turn any repository into a **strategic brief**: five answers (idea, problem, why
it wins, how, similar repos) backed by two interactive graphs (concept map +
competitive landscape). You orchestrate three analyzer agents, assemble their
output into a validated `repo-brief.json`, and render the vendored dashboard.

**Architecture you are driving:** the agents produce judgment; the deterministic
`grasp-assemble` CLI validates and renders; `repo-brief.json` is the only
contract between them. Never hand-edit the brief — fix the agent that produced
the bad fragment and re-assemble.

## Phase 0 — Resolve target + run the wizard

1. Determine the target: a bare `/grasp` means the current directory; otherwise a
   local path or a public GitHub URL. For a URL, shallow-clone to a temp dir
   (`git clone --depth 1`); if that fails, fall back to README/metadata via the
   GitHub API.
2. Run the **wizard** with `AskUserQuestion` — two axes, defaults pre-selected:
   - **depth** — `docs` (README/docs/manifests only) · `skim` (+ entry points &
     core files, *recommended*) · `deep` (+ trace the full implementation).
   - **broadness** — `offline` (only what's in the repo) · `web` (+ search for
     adoption & similar repos, *recommended*).

## Phase 1 — Gather sources (conditioned on depth × broadness)

- Always: README, `docs/`, manifests, file tree, git signals (stars where
  available, last commit, language).
- `skim`/`deep`: read entry points and core files.
- `web`: fetch GitHub stars/issues and search for "alternatives to X".

Record the gathered signals so you can build `meta` (repo, url, depth, broadness,
`analyzedAt` as an ISO timestamp, signals).

## Phase 2 — Dispatch the analyzer agents

Dispatch in parallel where independent. Each agent returns **only** a JSON
fragment; write each to `<target>/.grasp/fragments/`:

- **essence-analyzer** → `essence.json` (concept graph + idea/problem/how)
- **success-analyzer** → `success.json` (why + takeaway + evidence)
- **landscape-analyzer** → `landscape.json` (landscape graph) — **skip when
  `broadness: offline`**; the assembler then synthesizes a self-only landscape.

Also write `meta.json` (from Phase 1) into the same `fragments/` dir.

## Phase 3 — Assemble + validate (with one repair pass)

Run the deterministic CLI:

```bash
npx tsx packages/pipeline/src/cli.ts <target>/.grasp/fragments \
  --target <target> --dist packages/dashboard/dist
```

- Exit 0: it printed the openable `index.html` path on stdout. Proceed.
- Exit 1: it printed validation errors. Read them, identify which fragment is at
  fault (errors are prefixed `essence.` / `success.` / `landscape.` / `assembled
  brief:`), re-dispatch **only that agent** with the error text, overwrite its
  fragment, and re-run the CLI **once**. If it still fails, write the partial
  brief and warn the user which section is incomplete.
- Exit 2: a usage/IO problem (missing fragment file, unreadable JSON, or the
  dashboard `dist` is missing — build it with `npm run build --workspace
  @grasp/dashboard`).

## Phase 4 — Open the report

Open the `index.html` path the CLI printed (e.g. `open <path>` on macOS). It is a
self-contained page under `<target>/.grasp/dashboard/` that fetches
`./repo-brief.json` — no server, no build.

## Degradation & errors

- `broadness: web` but search is unavailable → degrade to offline; tell the user
  the landscape is inferred, not verified.
- GitHub clone fails → fall back to README/metadata; if that also fails, stop and
  explain.
- Huge repo at `deep` → cap the files analyzed and note the cap.
````

- [ ] **Step 4: Run the tests**

Run: `npm test --workspace @grasp/pipeline`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skills/grasp/SKILL.md packages/pipeline/src/__tests__/skill-contract.test.ts
git commit -m "feat(skill): grasp orchestrator (wizard, phases, assemble, render)"
```

---

## Task 8: Plugin manifest + end-to-end capstone

**Files:**
- Create: `.claude-plugin/plugin.json`
- Test: `packages/pipeline/src/__tests__/plugin.test.ts`

- [ ] **Step 1: Write the failing manifest + e2e test**

`packages/pipeline/src/__tests__/plugin.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateBrief } from "@grasp/schema";
import goldenSample from "@grasp/schema/sample-brief.json";
import { runCli } from "../cli-run";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../../..");
const fixturesDir = resolve(here, "fixtures");

describe("plugin manifest", () => {
  const manifest = JSON.parse(readFileSync(resolve(repoRoot, ".claude-plugin/plugin.json"), "utf8"));

  it("is a valid manifest named grasp with a description", () => {
    expect(manifest.name).toBe("grasp");
    expect(typeof manifest.description).toBe("string");
    expect(manifest.description.length).toBeGreaterThan(0);
  });

  it("ships the skill and agents it advertises (by convention)", () => {
    for (const rel of [
      "skills/grasp/SKILL.md",
      "agents/essence-analyzer.md",
      "agents/success-analyzer.md",
      "agents/landscape-analyzer.md",
    ]) {
      expect(existsSync(resolve(repoRoot, rel))).toBe(true);
    }
  });
});

describe("end-to-end: golden fragments → brief → render", () => {
  let work: string;
  let distDir: string;
  let targetDir: string;

  beforeEach(() => {
    work = mkdtempSync(join(tmpdir(), "grasp-e2e-"));
    distDir = join(work, "dist");
    targetDir = join(work, "repo");
    mkdirSync(distDir, { recursive: true });
    writeFileSync(join(distDir, "index.html"), "<!doctype html>");
    mkdirSync(targetDir, { recursive: true });
  });

  afterEach(() => rmSync(work, { recursive: true, force: true }));

  it("reproduces the exact golden brief on disk", () => {
    const code = runCli([fixturesDir, "--target", targetDir, "--dist", distDir]);
    expect(code).toBe(0);
    const written = JSON.parse(
      readFileSync(join(targetDir, ".grasp", "dashboard", "repo-brief.json"), "utf8"),
    );
    expect(validateBrief(written).ok).toBe(true);
    expect(written).toEqual(goldenSample);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test --workspace @grasp/pipeline`
Expected: FAIL — `.claude-plugin/plugin.json` does not exist (ENOENT in `readFileSync`).

- [ ] **Step 3: Write the plugin manifest**

`.claude-plugin/plugin.json` (skills and agents are auto-discovered from the
conventional `skills/` and `agents/` directories):

```json
{
  "name": "grasp",
  "version": "0.1.0",
  "description": "Produce a strategic brief of any repository — its main idea, the problem it solves, why it succeeds, how it works, and the competitive landscape — as interactive graphs and a self-contained HTML report.",
  "author": { "name": "grasp" }
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test --workspace @grasp/pipeline`
Expected: PASS.

- [ ] **Step 5: Run the whole pipeline suite + typecheck once more**

Run: `npm test --workspace @grasp/pipeline && npm run typecheck --workspace @grasp/pipeline`
Expected: all PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add .claude-plugin/plugin.json packages/pipeline/src/__tests__/plugin.test.ts
git commit -m "feat(plugin): manifest + end-to-end golden round-trip test"
```

---

## Final verification (after all tasks)

- [ ] Run the entire monorepo test suite: `npm test --workspaces --if-present`
  Expected: schema, dashboard, and pipeline suites all PASS.
- [ ] Typecheck every workspace: `npm run typecheck --workspace @grasp/schema && npm run typecheck --workspace @grasp/dashboard && npm run typecheck --workspace @grasp/pipeline`
  Expected: no errors.
- [ ] Confirm `git status` is clean except intended files (no stray `.grasp/` or temp dirs committed; `.grasp/` is already gitignored).

## What this plan deliberately leaves to Plan 4 (incremental)

- Fingerprints, `.grasp/state.json`, the Phase 0.5 staleness check.
- `--auto-update` post-commit hook, `--no-auto-update`, `--full`.
- Per-stream `brief.updatedAt` divergence (this plan sets all three to
  `meta.analyzedAt`; the incremental layer will preserve unchanged streams' prior
  timestamps).
