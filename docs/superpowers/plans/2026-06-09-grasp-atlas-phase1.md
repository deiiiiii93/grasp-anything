# grasp Product Atlas — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the abstract `conceptGraph` with a structured **Product Atlas** (continents → cities → landmarks) that powers a 3D-globe dashboard, a text "How it works" section, an accessible outline, and a static export outline — *no flow arcs yet*.

**Architecture:** One pure deterministic adapter — `buildAtlasView(doc) → AtlasView` — is the spine; WebGL (`react-globe.gl`) lives only in `AtlasGlobe.tsx` and consumes the view. The `atlas` hierarchy is validated by `@grasp/schema` (hard errors + a new warning tier) and is the only contract between analyzer and renderers. The 2D `ForceGraph` stays for the Landscape graph.

**Tech Stack:** npm-workspaces monorepo, TypeScript via `tsx`/Vitest (no build, `moduleResolution: Bundler`), Zod, React 18 + Vite, `react-globe.gl`/three.js (new).

**Spec:** `docs/superpowers/specs/2026-06-09-grasp-atlas-globe-design.md` · **UI mockup:** `docs/superpowers/specs/2026-06-09-grasp-atlas-ui.png` (mockup = source of truth for layout/copy; spec = source of truth for data/behavior).

---

## Conventions (read once)

- **Authoritative checks** are `tsc --noEmit` + `vitest`. IDE "Cannot find module"/"implicitly any" diagnostics LAG and are usually phantom — confirm with the real commands.
- Run a single package's tests with `npm test --workspace <name>` (cwd = package, so vitest globals/jsdom config load). Add a path to filter: `npm test --workspace @grasp/dashboard -- src/adapters/atlas.test.ts`.
- **Security (load-bearing):** atlas text comes from an LLM reading an UNTRUSTED repo. Every renderer escapes per its grammar (HTML entities for HTML/SVG, Markdown link escaping, `safeHref` for every URL). See `packages/export/src/url.ts`.
- **Migration note:** Task 1 removes `conceptGraph` from the schema. That turns the **pipeline / dashboard / export** suites red until their tasks update them — pipeline by Task 3, dashboard by Tasks 5–8, export by Task 9. Each task's "Expected" states which suite it restores; the final **Task 10** verifies the whole monorepo green. This is intentional, not a regression.

---

## File Structure

**`@grasp/schema`**
- Modify `src/schema.ts` — add atlas enums + `Landmark/City/Flow/Continent/Atlas` zod schemas; replace `conceptGraph` with `atlas` in `BriefDocSchema`; add atlas referential checks to `superRefine`. Remove the concept* exports.
- Create `src/warnings.ts` — `computeWarnings(doc): string[]` (the warning tier).
- Modify `src/validate.ts` — `ValidationResult` gains `warnings: string[]`; `validateBrief` runs `computeWarnings` on success.
- Modify `sample-brief.json` — atlas shape (golden fixture, reused everywhere).
- Modify `src/__tests__/*` — atlas validation + warning tests.

**`@grasp/pipeline`**
- Modify `src/fragments.ts` — `EssenceFragmentSchema` emits `atlas` (not `conceptGraph`).
- Modify `src/assemble.ts` — merge `atlas` into the doc.
- Modify `agents/essence-analyzer.md` — emit an atlas fragment (embedded example).
- Modify `skills/grasp/SKILL.md` — Phase-2 wording ("concept graph" → "atlas").
- Modify tests/fixtures referencing `conceptGraph`.

**`@grasp/dashboard`**
- Create `src/adapters/atlas.ts` — `buildAtlasView(doc): AtlasView` (pure spine) + `AtlasView`/view types + geo centroid table + deterministic placement + outline.
- Delete `src/adapters/concept.ts` + `src/components/ConceptGraph.tsx` (+ their tests).
- Modify `src/adapters/index.ts` — export `atlas`, drop `concept`.
- Create `src/components/AtlasOutline.tsx`, `AtlasDetail.tsx`, `HowItWorks.tsx`, `AtlasGlobe.tsx`, `AltitudeRail.tsx`, `AtlasIntro.tsx`, `CameraAltitudesTable.tsx`.
- Modify `src/App.tsx` — three-zone layout + top nav (Strategic | Atlas | Landscape | Evidence) + footer guarantees.
- Modify `src/index.css` — atlas/globe/three-zone styles.
- Modify `package.json` — add `react-globe.gl`, `three`, `@types/three`.

**`@grasp/export`**
- Create `src/atlasToMarkdown.ts`, `src/atlasToHtml.ts`.
- Modify `src/markdown.ts` + `src/printHtml.ts` — use the atlas outline in place of the concept graph; keep landscape.
- Modify `src/svg.ts` + `src/mermaid.ts` — drop `conceptToSvg`/`conceptToMermaid`.
- Modify `src/index.ts` + tests.

---

## Task 1: Atlas schema + referential validation (`@grasp/schema`)

**Files:**
- Modify: `packages/schema/src/schema.ts`
- Test: `packages/schema/src/__tests__/atlas.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/schema/src/__tests__/atlas.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateBrief } from "../index";
import sample from "../../sample-brief.json";

// A minimal valid atlas brief, built by mutating the golden sample.
function withAtlas(atlas: unknown) {
  const doc = JSON.parse(JSON.stringify(sample));
  doc.atlas = atlas;
  return doc;
}

const oneContinent = {
  continents: [
    {
      id: "c1", domain: "architecture", title: "Architecture",
      summary: "How it is structured.", evidenceIds: ["ev1"],
      cities: [
        { id: "city1", name: "Core", evidenceIds: [],
          landmarks: [{ id: "lm1", name: "Validator", detail: "x", evidenceIds: [] }] },
      ],
      flows: [],
    },
  ],
};

describe("atlas schema", () => {
  it("accepts the golden sample", () => {
    expect(validateBrief(sample).ok).toBe(true);
  });

  it("rejects a brief with no atlas", () => {
    const doc = JSON.parse(JSON.stringify(sample));
    delete doc.atlas;
    expect(validateBrief(doc).ok).toBe(false);
  });

  it("rejects duplicate continent domains", () => {
    const atlas = JSON.parse(JSON.stringify(oneContinent));
    atlas.continents.push(JSON.parse(JSON.stringify(atlas.continents[0])));
    atlas.continents[1].id = "c2";
    const r = validateBrief(withAtlas(atlas));
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/domain .*architecture.* unique|duplicate/i);
  });

  it("rejects duplicate ids across levels", () => {
    const atlas = JSON.parse(JSON.stringify(oneContinent));
    atlas.continents[0].cities[0].landmarks[0].id = "city1"; // collide with the city
    const r = validateBrief(withAtlas(atlas));
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/duplicate id .*city1/i);
  });

  it("rejects an evidence id that does not resolve", () => {
    const atlas = JSON.parse(JSON.stringify(oneContinent));
    atlas.continents[0].evidenceIds = ["nope"];
    expect(validateBrief(withAtlas(atlas)).ok).toBe(false);
  });

  it("rejects a flow endpoint outside its continent", () => {
    const atlas = JSON.parse(JSON.stringify(oneContinent));
    atlas.continents[0].flows = [
      { id: "fl1", source: "lm1", target: "elsewhere", type: "next" },
    ];
    const r = validateBrief(withAtlas(atlas));
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/flow .*elsewhere/i);
  });

  it("accepts a sparse continent (zero cities)", () => {
    const atlas = JSON.parse(JSON.stringify(oneContinent));
    atlas.continents[0].cities = [];
    expect(validateBrief(withAtlas(atlas)).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace @grasp/schema -- src/__tests__/atlas.test.ts`
Expected: FAIL — the golden sample still has `conceptGraph`, not `atlas`; `BriefDocSchema` rejects the unknown `atlas` key / accepts the missing one.

- [ ] **Step 3: Add atlas schemas + swap `conceptGraph` → `atlas` in `schema.ts`**

In `packages/schema/src/schema.ts`, **remove** the `conceptNodeTypes`/`conceptEdgeTypes` consts, `ConceptNode`/`ConceptEdge` schemas, their type exports, and the `ConceptNodeSchema`/`ConceptEdgeSchema` re-exports. **Add** (after the `landscapeEdgeTypes` line):

```ts
export const atlasDomains = [
  "architecture", "modules", "workflows",
  "businessFlows", "techSelection", "uiUxTaste",
] as const;
export const flowEdgeTypes = [
  "calls", "streams", "persists", "fansOut", "reviews", "next",
] as const;
export type AtlasDomain = (typeof atlasDomains)[number];
export type FlowEdgeType = (typeof flowEdgeTypes)[number];

const Landmark = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  detail: z.string().optional(),
  whyItMatters: z.string().optional(),
  techTag: z.string().optional(),
  tags: z.array(z.string()).default([]),
  evidenceIds: z.array(z.string()).default([]),
});
const City = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  summary: z.string().optional(),
  evidenceIds: z.array(z.string()).default([]),
  landmarks: z.array(Landmark).default([]),
});
const Flow = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  type: z.enum(flowEdgeTypes),
  label: z.string().optional(),
  evidenceIds: z.array(z.string()).default([]),
});
const Continent = z.object({
  id: z.string().min(1),
  domain: z.enum(atlasDomains),
  title: z.string().min(1),
  summary: z.string().min(1),
  evidenceIds: z.array(z.string()).default([]),
  cities: z.array(City).default([]),
  flows: z.array(Flow).default([]),
});
const Atlas = z.object({ continents: z.array(Continent).default([]) });
```

Replace the `conceptGraph` field in `BriefDocSchema` (currently
`conceptGraph: z.object({ nodes: ..., edges: ... })`) with:

```ts
    atlas: Atlas,
```

Export the new schemas at the bottom (alongside the kept ones):

```ts
export {
  LandscapeNode as LandscapeNodeSchema,
  LandscapeEdge as LandscapeEdgeSchema,
  Evidence as EvidenceSchema,
  Meta as MetaSchema,
  Landmark as LandmarkSchema,
  City as CitySchema,
  Flow as FlowSchema,
  Continent as ContinentSchema,
  Atlas as AtlasSchema,
};
```

- [ ] **Step 4: Replace the concept checks in `superRefine` with atlas checks**

In `BriefDocSchema.superRefine`, **delete** the two blocks that count the `idea` node and validate `doc.conceptGraph.edges`. **Keep** the landscape `self` count, the landscape edge endpoint checks, the landscape-node evidence checks, the `brief.evidence` checks, and the landscape required-field checks. **Add** this atlas block inside the same `superRefine` (reuse the existing `evidenceIds` set built from `doc.evidence`):

```ts
    // --- Atlas referential integrity ---
    const evidenceIdSet = new Set(doc.evidence.map((e) => e.id));
    const seenIds = new Set<string>();
    const seenDomains = new Set<string>();
    const dupId = (id: string, path: (string | number)[]) => {
      if (seenIds.has(id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate id '${id}'`, path });
      }
      seenIds.add(id);
    };
    const checkEv = (ids: string[], path: (string | number)[]) =>
      ids.forEach((id, j) => {
        if (!evidenceIdSet.has(id))
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `references missing evidence '${id}'`, path: [...path, j] });
      });

    doc.atlas.continents.forEach((cont, ci) => {
      dupId(cont.id, ["atlas", "continents", ci, "id"]);
      if (seenDomains.has(cont.domain)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `continent domain '${cont.domain}' must be unique`, path: ["atlas", "continents", ci, "domain"] });
      }
      seenDomains.add(cont.domain);
      checkEv(cont.evidenceIds, ["atlas", "continents", ci, "evidenceIds"]);

      const localIds = new Set<string>(); // city + landmark ids within this continent (for flow endpoints)
      cont.cities.forEach((city, cyi) => {
        dupId(city.id, ["atlas", "continents", ci, "cities", cyi, "id"]);
        localIds.add(city.id);
        checkEv(city.evidenceIds, ["atlas", "continents", ci, "cities", cyi, "evidenceIds"]);
        city.landmarks.forEach((lm, li) => {
          dupId(lm.id, ["atlas", "continents", ci, "cities", cyi, "landmarks", li, "id"]);
          localIds.add(lm.id);
          checkEv(lm.evidenceIds, ["atlas", "continents", ci, "cities", cyi, "landmarks", li, "evidenceIds"]);
        });
      });

      cont.flows.forEach((fl, fi) => {
        checkEv(fl.evidenceIds, ["atlas", "continents", ci, "flows", fi, "evidenceIds"]);
        for (const [end, key] of [[fl.source, "source"], [fl.target, "target"]] as const) {
          if (!localIds.has(end))
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `flow '${fl.id}' ${key} '${end}' not a city/landmark in this continent`, path: ["atlas", "continents", ci, "flows", fi, key] });
        }
      });
    });
```

> Note: keep the existing `const evidenceIds = new Set(...)` the landscape block uses, OR reuse `evidenceIdSet`. If both names exist, rename to one to avoid a redeclare error — `tsc` will catch it.

- [ ] **Step 5: Update the golden `sample-brief.json` to the atlas shape**

Replace the entire `"conceptGraph": { ... }` block in `packages/schema/sample-brief.json` with:

```json
  "atlas": {
    "continents": [
      {
        "id": "c_arch", "domain": "architecture", "title": "Architecture",
        "summary": "A deterministic core with LLM agents at the edges and a React dashboard on top.",
        "evidenceIds": ["ev1"],
        "cities": [
          { "id": "city_core", "name": "Deterministic core", "summary": "Validates and fingerprints the graph.", "evidenceIds": [],
            "landmarks": [
              { "id": "lm_validator", "name": "Schema validator", "detail": "A Zod schema is the single contract.", "whyItMatters": "Keeps agent output trustworthy.", "techTag": "Zod", "tags": ["determinism"], "evidenceIds": [] }
            ] },
          { "id": "city_dash", "name": "Dashboard", "summary": "Renders the graph for humans.", "evidenceIds": [],
            "landmarks": [
              { "id": "lm_react", "name": "React dashboard", "detail": "An interactive web view of the graph.", "whyItMatters": "Lowers onboarding effort to near zero.", "techTag": "React", "tags": ["ux"], "evidenceIds": ["ev1"] }
            ] }
        ],
        "flows": []
      },
      {
        "id": "c_mod", "domain": "modules", "title": "Modules",
        "summary": "Analyzer agents, the schema contract, and the dashboard.",
        "evidenceIds": [],
        "cities": [
          { "id": "city_agents", "name": "Analyzer agents", "evidenceIds": [],
            "landmarks": [
              { "id": "lm_batch", "name": "Batch file analyzer", "detail": "Reads files in batches and emits JSON.", "techTag": "LLM", "tags": [], "evidenceIds": [] }
            ] }
        ],
        "flows": []
      },
      {
        "id": "c_flow", "domain": "workflows", "title": "Workflows",
        "summary": "Analyze on demand; re-analyze only changed files on commit.",
        "evidenceIds": [],
        "cities": [
          { "id": "city_incr", "name": "Incremental updates", "evidenceIds": [],
            "landmarks": [
              { "id": "lm_fingerprint", "name": "Fingerprint diff", "detail": "Only changed files are re-analyzed.", "whyItMatters": "Keeps re-runs cheap.", "techTag": "sha256", "tags": [], "evidenceIds": [] }
            ] }
        ],
        "flows": []
      }
    ]
  },
```

(The `brief`, `landscapeGraph`, `meta`, and `evidence` blocks are unchanged.)

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test --workspace @grasp/schema -- src/__tests__/atlas.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 7: Fix any other schema tests that referenced `conceptGraph`**

Run: `npm test --workspace @grasp/schema` and `npx tsc --noEmit -p packages/schema/tsconfig.json`.
Any existing schema test asserting on `conceptGraph` must be updated to `atlas` or removed. Expected end state: schema suite GREEN, `tsc` clean.

- [ ] **Step 8: Commit**

```bash
git add packages/schema
git commit -m "feat(schema): replace conceptGraph with atlas hierarchy + referential validation"
```

---

## Task 2: Validation warning tier (`@grasp/schema`)

**Files:**
- Create: `packages/schema/src/warnings.ts`
- Modify: `packages/schema/src/validate.ts`, `packages/schema/src/index.ts`
- Test: `packages/schema/src/__tests__/warnings.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/schema/src/__tests__/warnings.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateBrief } from "../index";
import sample from "../../sample-brief.json";

const clone = () => JSON.parse(JSON.stringify(sample));

describe("validation warnings", () => {
  it("the golden sample has no warnings", () => {
    const r = validateBrief(sample);
    expect(r.ok).toBe(true);
    expect(r.warnings).toEqual([]);
  });

  it("warns when a continent has a summary but no evidence", () => {
    const doc = clone();
    doc.atlas.continents[1].evidenceIds = []; // modules continent already has none
    const r = validateBrief(doc);
    expect(r.ok).toBe(true);
    expect(r.warnings.join("\n")).toMatch(/no evidence/i);
  });

  it("warns when a landmark has no detail", () => {
    const doc = clone();
    delete doc.atlas.continents[0].cities[0].landmarks[0].detail;
    expect(validateBrief(doc).warnings.join("\n")).toMatch(/no detail/i);
  });

  it("warns when a city has zero landmarks", () => {
    const doc = clone();
    doc.atlas.continents[0].cities[0].landmarks = [];
    expect(validateBrief(doc).warnings.join("\n")).toMatch(/zero landmarks/i);
  });

  it("warns when fewer than three continents are populated", () => {
    const doc = clone();
    doc.atlas.continents = doc.atlas.continents.slice(0, 2);
    expect(validateBrief(doc).warnings.join("\n")).toMatch(/fewer than three/i);
  });

  it("warns when the landmark count exceeds the performance cap", () => {
    const doc = clone();
    const city = doc.atlas.continents[0].cities[0];
    city.landmarks = Array.from({ length: 121 }, (_, i) => ({ id: `g${i}`, name: `g${i}`, detail: "d", evidenceIds: [], tags: [] }));
    expect(validateBrief(doc).warnings.join("\n")).toMatch(/performance cap|too many landmarks/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace @grasp/schema -- src/__tests__/warnings.test.ts`
Expected: FAIL — `r.warnings` is `undefined`.

- [ ] **Step 3: Implement `computeWarnings`**

Create `packages/schema/src/warnings.ts`:

```ts
import type { BriefDoc } from "./schema";

const MAX_LANDMARKS = 120;

/** Non-fatal advisories about a thin or oversized atlas. Never fails the brief. */
export function computeWarnings(doc: BriefDoc): string[] {
  const out: string[] = [];
  const continents = doc.atlas.continents;
  let landmarkCount = 0;
  let populated = 0;

  for (const c of continents) {
    if (c.cities.length > 0) populated += 1;
    if (c.summary && c.evidenceIds.length === 0)
      out.push(`continent '${c.domain}' has a summary but no evidence`);
    for (const city of c.cities) {
      if (city.landmarks.length === 0) out.push(`city '${city.name}' has zero landmarks`);
      for (const lm of city.landmarks) {
        landmarkCount += 1;
        if (!lm.detail) out.push(`landmark '${lm.name}' has no detail`);
      }
    }
  }

  if (populated < 3) out.push(`atlas has fewer than three populated continents (${populated})`);
  if (landmarkCount > MAX_LANDMARKS)
    out.push(`landmark count ${landmarkCount} exceeds the performance cap (${MAX_LANDMARKS})`);
  return out;
}
```

- [ ] **Step 4: Wire warnings into `validateBrief`**

Replace `packages/schema/src/validate.ts` with:

```ts
import { BriefDocSchema, type BriefDoc } from "./schema";
import { computeWarnings } from "./warnings";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  data?: BriefDoc;
}

export function validateBrief(data: unknown): ValidationResult {
  const result = BriefDocSchema.safeParse(data);
  if (result.success) {
    return { ok: true, errors: [], warnings: computeWarnings(result.data), data: result.data };
  }
  const errors = result.error.issues.map((issue) => {
    const path = issue.path.join(".") || "(root)";
    return `${path}: ${issue.message}`;
  });
  return { ok: false, errors, warnings: [] };
}
```

Add to `packages/schema/src/index.ts`:

```ts
export * from "./warnings";
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test --workspace @grasp/schema` and `npx tsc --noEmit -p packages/schema/tsconfig.json`
Expected: schema suite GREEN (incl. the 6 new warning tests), `tsc` clean.

- [ ] **Step 6: Commit**

```bash
git add packages/schema
git commit -m "feat(schema): add non-fatal warning tier to validateBrief"
```

---

## Task 3: Pipeline fragments + assemble emit/merge atlas (`@grasp/pipeline`)

**Files:**
- Modify: `packages/pipeline/src/fragments.ts`, `packages/pipeline/src/assemble.ts`
- Test: `packages/pipeline/src/__tests__/assemble.test.ts` (existing — update), and any fixture using `conceptGraph`.

- [ ] **Step 1: Update `EssenceFragmentSchema` to carry `atlas`**

In `packages/pipeline/src/fragments.ts`: change the imports (drop `ConceptNodeSchema`, `ConceptEdgeSchema`; add `AtlasSchema`):

```ts
import {
  AtlasSchema,
  LandscapeNodeSchema,
  LandscapeEdgeSchema,
  EvidenceSchema,
} from "@grasp/schema";
```

Replace the `conceptGraph: z.object({ nodes: ..., edges: ... })` field of `EssenceFragmentSchema` with:

```ts
  atlas: AtlasSchema,
```

(Leave `idea`, `problem`, `how`, `evidence`, `briefEvidence` as-is.)

- [ ] **Step 2: Update `assemble` to put `atlas` on the doc**

In `packages/pipeline/src/assemble.ts`, in the `doc` object literal, replace
`conceptGraph: essence.conceptGraph,` with:

```ts
    atlas: essence.atlas,
```

- [ ] **Step 3: Update the assemble test + golden essence fragment**

Run: `npm test --workspace @grasp/pipeline -- src/__tests__/assemble.test.ts`
Expected first: FAIL (the test's essence input still has `conceptGraph`).

In the test (and any `__fixtures__`/inline essence fragment it builds), replace the `conceptGraph` object with the `atlas` object from the golden sample (copy the `atlas` block from `packages/schema/sample-brief.json`). Assert the assembled doc has `result.doc.atlas.continents.length > 0` instead of any `conceptGraph` assertion.

- [ ] **Step 4: Run the pipeline suite**

Run: `npm test --workspace @grasp/pipeline` and `npx tsc --noEmit -p packages/pipeline/tsconfig.json`
Expected: pipeline suite GREEN, `tsc` clean. (Round-trip golden test now flows essence.atlas → assemble → validateBrief.)

- [ ] **Step 5: Commit**

```bash
git add packages/pipeline/src
git commit -m "feat(pipeline): essence fragment + assemble carry atlas (replacing conceptGraph)"
```

---

## Task 4: essence-analyzer agent + SKILL wording (`@grasp/pipeline` prose)

**Files:**
- Modify: `agents/essence-analyzer.md`, `skills/grasp/SKILL.md`
- Test: `packages/pipeline/src/__tests__/agent-contracts.test.ts` (existing — extracts the embedded ```json``` example and validates it as an `EssenceFragmentSchema`).

- [ ] **Step 1: Run the contract test to see it fail**

Run: `npm test --workspace @grasp/pipeline -- agent-contracts`
Expected: FAIL — the embedded example in `essence-analyzer.md` still has `conceptGraph`, which `EssenceFragmentSchema` no longer accepts.

- [ ] **Step 2: Rewrite the agent's "What you must output" + example**

In `agents/essence-analyzer.md`, replace the `conceptGraph` description and the `<!-- example -->` ```json``` block. The new contract paragraph:

> - `atlas.continents` — one entry per understanding domain you can populate
>   (`architecture`, `modules`, `workflows`, `businessFlows`, `techSelection`,
>   `uiUxTaste`). Each continent: `{ id, domain, title, summary, evidenceIds?,
>   cities[], flows[] }`. Each city: `{ id, name, summary?, evidenceIds?,
>   landmarks[] }`. Each landmark: `{ id, name, detail?, whyItMatters?, techTag?,
>   tags?, evidenceIds? }`. **All ids must be globally unique.** Leave `flows: []`
>   (flows are a later phase). Populate at least three continents when the repo
>   supports it; a continent may have zero cities.

Replace the embedded example with (this MUST validate as `EssenceFragmentSchema`):

```json
{
  "idea": "Turn any codebase into an interactive knowledge graph so newcomers can grasp its architecture without reading every file.",
  "problem": "Onboarding into an unfamiliar codebase is slow; engineers reverse-engineer structure from scattered files.",
  "how": "LLM sub-agents analyze files in batches and emit a validated JSON graph; a deterministic core validates it; a React dashboard renders it.",
  "atlas": {
    "continents": [
      {
        "id": "c_arch", "domain": "architecture", "title": "Architecture",
        "summary": "A deterministic core with LLM agents at the edges and a dashboard on top.",
        "evidenceIds": ["ev1"],
        "cities": [
          { "id": "city_core", "name": "Deterministic core", "evidenceIds": [],
            "landmarks": [
              { "id": "lm_validator", "name": "Schema validator", "detail": "Zod schema is the single contract.", "whyItMatters": "Keeps agent output trustworthy.", "techTag": "Zod", "evidenceIds": [] }
            ] }
        ],
        "flows": []
      }
    ]
  },
  "evidence": [
    { "id": "ev1", "claim": "Ships an interactive web dashboard", "source": "README", "url": "https://github.com/Lum1104/Understand-Anything", "verified": true }
  ],
  "briefEvidence": {}
}
```

- [ ] **Step 3: Update SKILL.md Phase-2 wording**

In `skills/grasp/SKILL.md`, change the essence-analyzer bullet from "(concept graph + idea/problem/how)" to "(**atlas** continents/cities/landmarks + idea/problem/how)". Replace any other "concept graph" mention with "atlas". Do **not** rename the CLI tokens (`grasp-assemble`, `grasp-state`, `grasp-export`).

- [ ] **Step 4: Run the contract + drift tests**

Run: `npm test --workspace @grasp/pipeline -- agent-contracts` then `npm test --workspace @grasp/pipeline`
Expected: GREEN (embedded example validates; SKILL drift guard, if it checks tokens, still passes).

- [ ] **Step 5: Commit**

```bash
git add agents/essence-analyzer.md skills/grasp/SKILL.md packages/pipeline/src/__tests__
git commit -m "docs(agent): essence-analyzer emits an atlas fragment; SKILL wording"
```

---

## Task 5: `buildAtlasView` — the pure spine (`@grasp/dashboard`)

**Files:**
- Create: `packages/dashboard/src/adapters/atlas.ts`
- Delete: `packages/dashboard/src/adapters/concept.ts`, `packages/dashboard/src/adapters/concept.test.ts`
- Modify: `packages/dashboard/src/adapters/index.ts`
- Test: `packages/dashboard/src/adapters/atlas.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/dashboard/src/adapters/atlas.test.ts`:

```ts
import { buildAtlasView, CONTINENT_GEO } from "./atlas";
import { sampleDoc } from "../test-utils/sample";

describe("buildAtlasView", () => {
  it("is deterministic (same doc → identical lat/lng)", () => {
    const a = buildAtlasView(sampleDoc);
    const b = buildAtlasView(sampleDoc);
    expect(b.landmarks.map((l) => [l.id, l.lat, l.lng])).toEqual(
      a.landmarks.map((l) => [l.id, l.lat, l.lng]),
    );
  });

  it("maps each continent's domain to its real-world geography", () => {
    const view = buildAtlasView(sampleDoc);
    const arch = view.continents.find((c) => c.domain === "architecture")!;
    expect(arch).toBeDefined();
    expect(arch.lat).toBe(CONTINENT_GEO.architecture.lat);
    expect(arch.continentName).toBe("Asia");
    expect(arch.motif).toBe("Great Wall");
  });

  it("places every city/landmark within its continent's ring radius", () => {
    const view = buildAtlasView(sampleDoc);
    const contById = new Map(view.continents.map((c) => [c.id, c]));
    for (const city of view.cities) {
      const c = contById.get(city.continentId)!;
      expect(Math.hypot(city.lat - c.lat, city.lng - c.lng)).toBeLessThanOrEqual(40);
    }
  });

  it("builds an outline that mirrors the hierarchy", () => {
    const view = buildAtlasView(sampleDoc);
    const arch = view.outline.find((n) => n.kind === "continent" && n.title === "Architecture")!;
    expect(arch.children.map((c) => c.kind)).toEqual(["city", "city"]);
    expect(arch.children[0].children[0].kind).toBe("landmark");
  });

  it("exposes landmark detail-panel fields", () => {
    const view = buildAtlasView(sampleDoc);
    const lm = view.landmarks.find((l) => l.id === "lm_validator")!;
    expect(lm.whyItMatters).toMatch(/trustworthy/);
    expect(lm.techTag).toBe("Zod");
    expect(lm.evidence.map((e) => e.id)).toEqual([]);
  });

  it("has no flow arcs in Phase 1", () => {
    expect(buildAtlasView(sampleDoc).arcs).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace @grasp/dashboard -- src/adapters/atlas.test.ts`
Expected: FAIL — `./atlas` does not exist.

- [ ] **Step 3: Implement `buildAtlasView`**

Create `packages/dashboard/src/adapters/atlas.ts`:

```ts
import type { BriefDoc, AtlasDomain } from "@grasp/schema";
import { resolveEvidence, type EvidenceChip } from "./brief";

// Domain → real-world geography. The data stays geography-agnostic; this fixed
// table is the only place that knows about Earth. lat/lng are continent centroids.
export const CONTINENT_GEO: Record<AtlasDomain, { continentName: string; motif: string; lat: number; lng: number; color: string }> = {
  architecture:   { continentName: "Asia",          motif: "Great Wall",        lat: 45,  lng: 90,   color: "#e5687a" },
  modules:        { continentName: "Europe",        motif: "Eiffel Tower",      lat: 50,  lng: 15,   color: "#b794f6" },
  workflows:      { continentName: "North America", motif: "Statue of Liberty", lat: 45,  lng: -100, color: "#5aa9f0" },
  businessFlows:  { continentName: "Africa",        motif: "Pyramids",          lat: 2,   lng: 20,   color: "#f5c451" },
  techSelection:  { continentName: "South America", motif: "Machu Picchu",      lat: -15, lng: -60,  color: "#5bd1a0" },
  uiUxTaste:      { continentName: "Oceania",       motif: "Opera House",       lat: -25, lng: 135,  color: "#f0974a" },
};

export interface ContinentView {
  id: string; domain: AtlasDomain; title: string; summary: string;
  continentName: string; motif: string; lat: number; lng: number; color: string;
  cityCount: number; landmarkCount: number; evidence: EvidenceChip[];
}
export interface CityView {
  id: string; continentId: string; name: string; summary?: string;
  lat: number; lng: number; color: string; evidence: EvidenceChip[];
}
export interface LandmarkView {
  id: string; cityId: string; continentId: string; name: string;
  detail?: string; whyItMatters?: string; techTag?: string; tags: string[];
  lat: number; lng: number; color: string; evidence: EvidenceChip[];
}
export interface ArcView { id: string; startLat: number; startLng: number; endLat: number; endLng: number; label?: string; }
export interface OutlineNode {
  id: string; kind: "continent" | "city" | "landmark"; title: string;
  children: OutlineNode[];
}
export interface AtlasView {
  continents: ContinentView[];
  cities: CityView[];
  landmarks: LandmarkView[];
  arcs: ArcView[];
  outline: OutlineNode[];
}

// Deterministic hash → [0,1). Pure function of the id string only.
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}
// Seeded ring offset around a centroid (degrees). Index spreads points by angle.
function ringPoint(centroid: { lat: number; lng: number }, id: string, index: number, ring: number) {
  const angle = (index * 137.5 + hash01(id) * 360) * (Math.PI / 180); // golden-angle spread
  const r = ring + hash01(id + "r") * 6;
  return { lat: centroid.lat + r * Math.sin(angle), lng: centroid.lng + r * Math.cos(angle) };
}

export function buildAtlasView(doc: BriefDoc): AtlasView {
  const continents: ContinentView[] = [];
  const cities: CityView[] = [];
  const landmarks: LandmarkView[] = [];
  const outline: OutlineNode[] = [];

  for (const cont of doc.atlas.continents) {
    const geo = CONTINENT_GEO[cont.domain];
    const centroid = { lat: geo.lat, lng: geo.lng };
    let landmarkCount = 0;
    const contOutline: OutlineNode = { id: cont.id, kind: "continent", title: cont.title, children: [] };

    cont.cities.forEach((city, ci) => {
      const cp = ringPoint(centroid, city.id, ci, 14);
      cities.push({ id: city.id, continentId: cont.id, name: city.name, summary: city.summary, lat: cp.lat, lng: cp.lng, color: geo.color, evidence: resolveEvidence(doc, city.evidenceIds) });
      const cityOutline: OutlineNode = { id: city.id, kind: "city", title: city.name, children: [] };
      city.landmarks.forEach((lm, li) => {
        const lp = ringPoint(cp, lm.id, li, 6);
        landmarks.push({ id: lm.id, cityId: city.id, continentId: cont.id, name: lm.name, detail: lm.detail, whyItMatters: lm.whyItMatters, techTag: lm.techTag, tags: lm.tags, lat: lp.lat, lng: lp.lng, color: geo.color, evidence: resolveEvidence(doc, lm.evidenceIds) });
        cityOutline.children.push({ id: lm.id, kind: "landmark", title: lm.name, children: [] });
        landmarkCount += 1;
      });
      contOutline.children.push(cityOutline);
    });

    continents.push({ id: cont.id, domain: cont.domain, title: cont.title, summary: cont.summary, continentName: geo.continentName, motif: geo.motif, lat: geo.lat, lng: geo.lng, color: geo.color, cityCount: cont.cities.length, landmarkCount, evidence: resolveEvidence(doc, cont.evidenceIds) });
    outline.push(contOutline);
  }

  return { continents, cities, landmarks, arcs: [], outline };
}
```

- [ ] **Step 4: Delete the concept adapter + update the barrel**

```bash
git rm packages/dashboard/src/adapters/concept.ts packages/dashboard/src/adapters/concept.test.ts
```

In `packages/dashboard/src/adapters/index.ts` replace `export * from "./concept";` with `export * from "./atlas";`. (`GraphEdgeVM` was defined in concept.ts and imported by `landscape.ts` — move that small interface into `landscape.ts` itself: add `export interface GraphEdgeVM { id: string; source: string; target: string; type: string; }` at the top of `landscape.ts` and drop its `import { ... GraphEdgeVM } from "./concept"`.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test --workspace @grasp/dashboard -- src/adapters/atlas.test.ts src/adapters/landscape.test.ts`
Expected: PASS (atlas 6 tests; landscape still green after the `GraphEdgeVM` move).

- [ ] **Step 6: Commit**

```bash
git add packages/dashboard/src/adapters
git commit -m "feat(dashboard): buildAtlasView pure spine (geo mapping + deterministic placement + outline)"
```

---

## Task 6: AtlasOutline + AtlasDetail + HowItWorks (`@grasp/dashboard`)

**Files:**
- Create: `packages/dashboard/src/components/AtlasDetail.tsx`, `AtlasOutline.tsx`, `HowItWorks.tsx`
- Test: `packages/dashboard/src/components/AtlasOutline.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/dashboard/src/components/AtlasOutline.test.tsx`:

```tsx
import { render, screen, fireEvent, within } from "@testing-library/react";
import { useState } from "react";
import { AtlasOutline } from "./AtlasOutline";
import { AtlasDetail } from "./AtlasDetail";
import { buildAtlasView } from "../adapters/atlas";
import { sampleDoc } from "../test-utils/sample";

function Harness() {
  const view = buildAtlasView(sampleDoc);
  const [sel, setSel] = useState<string | null>(null);
  const landmark = view.landmarks.find((l) => l.id === sel) ?? null;
  return (
    <div>
      <AtlasOutline view={view} selectedId={sel} onSelect={setSel} />
      <AtlasDetail landmark={landmark} />
    </div>
  );
}

describe("AtlasOutline", () => {
  it("renders a button for every continent, city, and landmark", () => {
    render(<Harness />);
    expect(screen.getByTestId("outline-node-c_arch")).toBeInTheDocument();
    expect(screen.getByTestId("outline-node-city_core")).toBeInTheDocument();
    expect(screen.getByTestId("outline-node-lm_validator")).toBeInTheDocument();
  });

  it("clicking a landmark selects it and shows whyItMatters in the detail panel", () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("outline-node-lm_validator"));
    const detail = screen.getByTestId("atlas-detail");
    expect(within(detail).getByRole("heading")).toHaveTextContent("Schema validator");
    expect(within(detail).getByText(/trustworthy/)).toBeInTheDocument();
    expect(within(detail).getByText("Zod")).toBeInTheDocument();
  });

  it("selects a landmark via keyboard (Enter)", () => {
    render(<Harness />);
    fireEvent.keyDown(screen.getByTestId("outline-node-lm_react"), { key: "Enter" });
    expect(within(screen.getByTestId("atlas-detail")).getByRole("heading")).toHaveTextContent("React dashboard");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace @grasp/dashboard -- src/components/AtlasOutline.test.tsx`
Expected: FAIL — components do not exist.

- [ ] **Step 3: Implement the three components**

Create `packages/dashboard/src/components/AtlasDetail.tsx`:

```tsx
import type { LandmarkView } from "../adapters/atlas";
import { EvidenceChips } from "./EvidenceChips";

export function AtlasDetail({ landmark }: { landmark: LandmarkView | null }) {
  if (!landmark) {
    return (
      <aside className="atlas-detail" data-testid="atlas-detail">
        <p className="atlas-detail-empty">Select a landmark to see why it matters.</p>
      </aside>
    );
  }
  return (
    <aside className="atlas-detail" data-testid="atlas-detail">
      <span className="atlas-detail-kind">Landmark</span>
      <h3>
        {landmark.name}
        {landmark.techTag && <span className="atlas-tech">{landmark.techTag}</span>}
      </h3>
      {landmark.detail && <p>{landmark.detail}</p>}
      {landmark.whyItMatters && (
        <div className="atlas-why">
          <span className="atlas-why-label">Why it matters</span>
          <p>{landmark.whyItMatters}</p>
        </div>
      )}
      {landmark.tags.length > 0 && (
        <ul className="atlas-tags">
          {landmark.tags.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
      <EvidenceChips evidence={landmark.evidence} />
    </aside>
  );
}
```

Create `packages/dashboard/src/components/AtlasOutline.tsx`:

```tsx
import type { AtlasView, OutlineNode } from "../adapters/atlas";

function Node({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: OutlineNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <li>
      <button
        type="button"
        data-testid={`outline-node-${node.id}`}
        className={`outline-node depth-${depth} kind-${node.kind}${node.id === selectedId ? " selected" : ""}`}
        aria-pressed={node.id === selectedId}
        onClick={() => onSelect(node.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(node.id);
          }
        }}
      >
        <span className="outline-kind">{node.kind}</span> {node.title}
      </button>
      {node.children.length > 0 && (
        <ul>
          {node.children.map((c) => (
            <Node key={c.id} node={c} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function AtlasOutline({
  view,
  selectedId,
  onSelect,
}: {
  view: AtlasView;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <nav className="atlas-outline" data-testid="atlas-outline" aria-label="Atlas outline">
      <ul>
        {view.outline.map((n) => (
          <Node key={n.id} node={n} depth={0} selectedId={selectedId} onSelect={onSelect} />
        ))}
      </ul>
    </nav>
  );
}
```

Create `packages/dashboard/src/components/HowItWorks.tsx`:

```tsx
import type { AtlasView } from "../adapters/atlas";
import { EvidenceChips } from "./EvidenceChips";

export function HowItWorks({ view }: { view: AtlasView }) {
  return (
    <section className="how-it-works" data-testid="how-it-works">
      <h2>How it works</h2>
      {view.continents.map((c) => (
        <article key={c.id} className="how-domain">
          <h3>
            {c.title} <span className="how-continent">{c.continentName}</span>
          </h3>
          <p>{c.summary}</p>
          <p className="how-counts">
            {c.cityCount} cities · {c.landmarkCount} landmarks
          </p>
          <EvidenceChips evidence={c.evidence} />
        </article>
      ))}
    </section>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --workspace @grasp/dashboard -- src/components/AtlasOutline.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/dashboard/src/components/AtlasDetail.tsx packages/dashboard/src/components/AtlasOutline.tsx packages/dashboard/src/components/HowItWorks.tsx packages/dashboard/src/components/AtlasOutline.test.tsx
git commit -m "feat(dashboard): AtlasOutline (a11y) + AtlasDetail (whyItMatters) + HowItWorks"
```

---

## Task 7: AtlasGlobe — lazy WebGL globe with fallback (`@grasp/dashboard`)

**Files:**
- Modify: `packages/dashboard/package.json` (deps)
- Create: `packages/dashboard/src/components/AtlasGlobe.tsx`, `packages/dashboard/src/components/AltitudeRail.tsx`
- Test: `packages/dashboard/src/components/AtlasGlobe.test.tsx` (create, mocks `react-globe.gl`)

- [ ] **Step 1: Add dependencies**

Edit `packages/dashboard/package.json` `dependencies`: add `"react-globe.gl": "^2.27.0"` and `"three": "^0.160.0"`; `devDependencies`: add `"@types/three": "^0.160.0"`. Then:

```bash
npm install
```

Expected: installs without error; `node -e "require.resolve('react-globe.gl')"` succeeds.

- [ ] **Step 2: Write the failing test (mock the WebGL library)**

Create `packages/dashboard/src/components/AtlasGlobe.test.tsx`:

```tsx
import { render, screen, fireEvent, within } from "@testing-library/react";
import { vi } from "vitest";
import { AtlasGlobe } from "./AtlasGlobe";
import { buildAtlasView } from "../adapters/atlas";
import { sampleDoc } from "../test-utils/sample";

// jsdom has no WebGL; AtlasGlobe must detect that and render the outline fallback.
vi.mock("./globeImpl", () => ({ GlobeImpl: () => null, webglAvailable: () => false }));

describe("AtlasGlobe (no WebGL)", () => {
  it("renders the outline fallback when WebGL is unavailable", () => {
    const view = buildAtlasView(sampleDoc);
    render(<AtlasGlobe view={view} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByTestId("atlas-outline")).toBeInTheDocument();
    expect(screen.getByTestId("outline-node-lm_validator")).toBeInTheDocument();
  });

  it("selecting a node in the fallback bubbles up via onSelect", () => {
    const view = buildAtlasView(sampleDoc);
    const onSelect = vi.fn();
    render(<AtlasGlobe view={view} selectedId={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("outline-node-lm_validator"));
    expect(onSelect).toHaveBeenCalledWith("lm_validator");
  });
});
```

- [ ] **Step 3: Implement the WebGL boundary + the component**

Create `packages/dashboard/src/components/globeImpl.tsx` (the ONLY file importing the WebGL lib, so it can be mocked/lazy-loaded):

```tsx
import Globe from "react-globe.gl";
import type { AtlasView } from "../adapters/atlas";

export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

export function GlobeImpl({
  view,
  onSelect,
}: {
  view: AtlasView;
  onSelect: (id: string) => void;
}) {
  const points = [
    ...view.cities.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng, color: c.color, r: 0.4 })),
    ...view.landmarks.map((l) => ({ id: l.id, lat: l.lat, lng: l.lng, color: l.color, r: 0.25 })),
  ];
  const labels = view.continents.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng, text: `${c.title} · ${c.continentName}`, color: c.color }));
  return (
    <Globe
      width={620}
      height={460}
      backgroundColor="#0c0e12"
      pointsData={points}
      pointLat="lat"
      pointLng="lng"
      pointColor="color"
      pointAltitude={0.02}
      pointRadius="r"
      onPointClick={(p: { id: string }) => onSelect(p.id)}
      labelsData={labels}
      labelLat="lat"
      labelLng="lng"
      labelText="text"
      labelColor="color"
      labelSize={1.4}
      onLabelClick={(l: { id: string }) => onSelect(l.id)}
    />
  );
}
```

Create `packages/dashboard/src/components/AtlasGlobe.tsx`:

```tsx
import { AtlasOutline } from "./AtlasOutline";
import { webglAvailable, GlobeImpl } from "./globeImpl";
import type { AtlasView } from "../adapters/atlas";

export function AtlasGlobe({
  view,
  selectedId,
  onSelect,
}: {
  view: AtlasView;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (!webglAvailable()) {
    // Graceful fallback: the same data as the accessible outline.
    return (
      <div className="atlas-globe-fallback" data-testid="atlas-globe-fallback">
        <p className="atlas-fallback-note">3D globe unavailable — showing the outline.</p>
        <AtlasOutline view={view} selectedId={selectedId} onSelect={onSelect} />
      </div>
    );
  }
  return (
    <div className="atlas-globe" data-testid="atlas-globe">
      <GlobeImpl view={view} onSelect={onSelect} />
    </div>
  );
}
```

Create `packages/dashboard/src/components/AltitudeRail.tsx`:

```tsx
const STEPS = [
  { n: 1, label: "Orbit", caption: "Whole product" },
  { n: 2, label: "Continent", caption: "Explore one" },
  { n: 3, label: "City", caption: "Landmarks & flows" },
  { n: 4, label: "Landmark", caption: "Details & evidence" },
] as const;

export function AltitudeRail({ level }: { level: 1 | 2 | 3 | 4 }) {
  return (
    <ol className="altitude-rail" data-testid="altitude-rail">
      {STEPS.map((s) => (
        <li key={s.n} className={s.n === level ? "active" : ""} aria-current={s.n === level ? "step" : undefined}>
          <span className="rail-n">{s.n}</span>
          <span className="rail-label">{s.label}</span>
          <span className="rail-caption">{s.caption}</span>
        </li>
      ))}
    </ol>
  );
}
```

> Note: the live globe's camera/LOD flights are exercised manually; jsdom can't run WebGL, so automated tests cover the **fallback + onSelect** path (above) and the deterministic data via `buildAtlasView`. The breadcrumb/altitude state is owned by `App.tsx` (Task 8) and tested there.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --workspace @grasp/dashboard -- src/components/AtlasGlobe.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/dashboard/package.json package-lock.json packages/dashboard/src/components/globeImpl.tsx packages/dashboard/src/components/AtlasGlobe.tsx packages/dashboard/src/components/AltitudeRail.tsx packages/dashboard/src/components/AtlasGlobe.test.tsx
git commit -m "feat(dashboard): AtlasGlobe (react-globe.gl) with WebGL-absent outline fallback"
```

---

## Task 8: Three-zone App shell + top nav + altitude/breadcrumb state (`@grasp/dashboard`)

**Files:**
- Modify: `packages/dashboard/src/App.tsx`, `packages/dashboard/src/components/ConceptGraph.tsx` (delete), `packages/dashboard/src/components/ConceptGraph.test.tsx` (delete)
- Create: `packages/dashboard/src/components/AtlasIntro.tsx`, `CameraAltitudesTable.tsx`
- Test: `packages/dashboard/src/App.test.tsx` (existing — update)

- [ ] **Step 1: Delete the concept component**

```bash
git rm packages/dashboard/src/components/ConceptGraph.tsx packages/dashboard/src/components/ConceptGraph.test.tsx
```

- [ ] **Step 2: Write the failing App test**

Replace `packages/dashboard/src/App.test.tsx` with:

```tsx
import { render, screen, fireEvent, within } from "@testing-library/react";
import { App } from "./App";
import { sampleDoc } from "./test-utils/sample";

describe("App", () => {
  it("shows the four top-nav tabs and defaults to Atlas", () => {
    render(<App doc={sampleDoc} />);
    for (const t of ["Strategic", "Atlas", "Landscape", "Evidence"]) {
      expect(screen.getByRole("tab", { name: t })).toBeInTheDocument();
    }
    expect(screen.getByRole("tab", { name: "Atlas" })).toHaveAttribute("aria-selected", "true");
  });

  it("renders the Atlas zones: intro, globe/outline, detail, how-it-works", () => {
    render(<App doc={sampleDoc} />);
    expect(screen.getByTestId("atlas-intro")).toBeInTheDocument();
    expect(screen.getByTestId("atlas-detail")).toBeInTheDocument();
    expect(screen.getByTestId("how-it-works")).toBeInTheDocument();
    expect(screen.getByTestId("altitude-rail")).toBeInTheDocument();
  });

  it("selecting a landmark updates the breadcrumb and detail panel", () => {
    render(<App doc={sampleDoc} />);
    fireEvent.click(screen.getByTestId("outline-node-lm_validator"));
    expect(screen.getByTestId("atlas-breadcrumb")).toHaveTextContent("Architecture");
    expect(within(screen.getByTestId("atlas-detail")).getByRole("heading")).toHaveTextContent("Schema validator");
  });

  it("switches to the Landscape tab", () => {
    render(<App doc={sampleDoc} />);
    fireEvent.click(screen.getByRole("tab", { name: "Landscape" }));
    expect(screen.getByTestId("landscape-graph")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Implement `AtlasIntro` + `CameraAltitudesTable`**

Create `packages/dashboard/src/components/AtlasIntro.tsx`:

```tsx
import { CONTINENT_GEO } from "../adapters/atlas";
import type { AtlasDomain } from "@grasp/schema";

const QUESTIONS: Record<AtlasDomain, string> = {
  architecture: "How is the system structured?",
  modules: "What are the building blocks?",
  workflows: "How does runtime flow work?",
  businessFlows: "How does user/value flow?",
  techSelection: "What was chosen and why?",
  uiUxTaste: "What is the design sensibility?",
};
const ORDER: AtlasDomain[] = ["architecture", "modules", "workflows", "businessFlows", "techSelection", "uiUxTaste"];

export function AtlasIntro() {
  return (
    <aside className="atlas-intro" data-testid="atlas-intro">
      <h2>Product Atlas</h2>
      <p className="atlas-intro-tagline">How it works — explore from Orbit to Landmark.</p>
      <p className="atlas-intro-blurb">A 3D globe that maps how this product works across six dimensions — from the big picture down to the details.</p>
      <h3 className="atlas-intro-h">Six domains · Six continents</h3>
      <ul className="atlas-intro-domains">
        {ORDER.map((d) => (
          <li key={d}>
            <span className="domain-dot" style={{ background: CONTINENT_GEO[d].color }} />
            <span className="domain-name">
              {d === "businessFlows" ? "Business Flows" : d === "techSelection" ? "Technical Selection" : d === "uiUxTaste" ? "UI/UX Taste" : d.charAt(0).toUpperCase() + d.slice(1)}
              <span className="domain-continent"> → {CONTINENT_GEO[d].continentName}</span>
            </span>
            <span className="domain-q">{QUESTIONS[d]}</span>
            <span className="domain-motif">{CONTINENT_GEO[d].motif}</span>
          </li>
        ))}
      </ul>
      <p className="atlas-intro-antarctica">Antarctica (optional) — Uncharted / low confidence (Phase 2+).</p>
    </aside>
  );
}
```

Create `packages/dashboard/src/components/CameraAltitudesTable.tsx`:

```tsx
import type { AtlasView } from "../adapters/atlas";

const QUESTION: Record<string, string> = {
  architecture: "How is the system structured?",
  modules: "What are the building blocks?",
  workflows: "How does runtime flow work?",
  businessFlows: "How does user/value flow?",
  techSelection: "What was chosen and why?",
  uiUxTaste: "What is the design sensibility?",
};

export function CameraAltitudesTable({ view, onSelect }: { view: AtlasView; onSelect: (id: string) => void }) {
  return (
    <div className="camera-altitudes" data-testid="camera-altitudes">
      <h3>Camera altitudes (what you see)</h3>
      <table>
        <tbody>
          {view.continents.map((c) => (
            <tr key={c.id} onClick={() => onSelect(c.id)}>
              <td><span className="domain-dot" style={{ background: c.color }} /> {c.title} <span className="muted">({c.continentName})</span></td>
              <td className="muted">{QUESTION[c.domain]}</td>
              <td className="nums">{c.cityCount} cities · {c.landmarkCount} landmarks</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="camera-altitudes-note">The atlas is also available as an outline in the export (Markdown/HTML) with Mermaid flow diagrams.</p>
    </div>
  );
}
```

- [ ] **Step 4: Rewrite `App.tsx` (three-zone + top nav + selection/breadcrumb state)**

Replace `packages/dashboard/src/App.tsx` with:

```tsx
import { useMemo, useState } from "react";
import type { BriefDoc } from "@grasp/schema";
import { buildCards, buildSignals } from "./adapters/brief";
import { buildAtlasView } from "./adapters/atlas";
import { Header } from "./components/Header";
import { BriefCard } from "./components/BriefCard";
import { LandscapeGraph } from "./components/LandscapeGraph";
import { AtlasGlobe } from "./components/AtlasGlobe";
import { AtlasOutline } from "./components/AtlasOutline";
import { AtlasDetail } from "./components/AtlasDetail";
import { AtlasIntro } from "./components/AtlasIntro";
import { AltitudeRail } from "./components/AltitudeRail";
import { HowItWorks } from "./components/HowItWorks";
import { CameraAltitudesTable } from "./components/CameraAltitudesTable";

type Tab = "strategic" | "atlas" | "landscape" | "evidence";

const GUARANTEES = [
  ["Accessible", "Use List view for screen readers and keyboard navigation."],
  ["Export ready", "The atlas exports as a structured outline + Mermaid flows."],
  ["Secure by default", "All items and links are escaped; only safe links open."],
  ["Deterministic layout", "Continents and landmarks are placed reproducibly."],
  ["Fallback", "If WebGL is unavailable, the outline is shown."],
] as const;

export function App({ doc }: { doc: BriefDoc }) {
  const signals = buildSignals(doc);
  const cards = buildCards(doc);
  const view = useMemo(() => buildAtlasView(doc), [doc]);
  const [tab, setTab] = useState<Tab>("atlas");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listView, setListView] = useState(false);

  // Resolve the selection to a breadcrumb + the detail landmark.
  const landmark = view.landmarks.find((l) => l.id === selectedId) ?? null;
  const crumb = useMemo(() => {
    const parts: string[] = ["Atlas"];
    const lm = view.landmarks.find((l) => l.id === selectedId);
    const city = view.cities.find((c) => c.id === selectedId) ?? (lm && view.cities.find((c) => c.id === lm.cityId));
    const contId = lm?.continentId ?? city?.continentId ?? view.continents.find((c) => c.id === selectedId)?.id;
    const cont = view.continents.find((c) => c.id === contId);
    if (cont) parts.push(cont.title, cont.continentName);
    if (city) parts.push(city.name);
    if (lm) parts.push(lm.name);
    return parts;
  }, [selectedId, view]);
  const level: 1 | 2 | 3 | 4 = landmark ? 4 : view.cities.some((c) => c.id === selectedId) ? 3 : view.continents.some((c) => c.id === selectedId) ? 2 : 1;

  return (
    <main className="app">
      <Header signals={signals} />
      <nav className="top-nav" role="tablist">
        {(["strategic", "atlas", "landscape", "evidence"] as Tab[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
            {t === "strategic" ? "Strategic" : t === "atlas" ? "Atlas" : t === "landscape" ? "Landscape" : "Evidence"}
          </button>
        ))}
      </nav>

      {tab === "strategic" && (
        <section className="cards-grid">
          {cards.map((card) => (
            <BriefCard key={card.key} card={card} />
          ))}
        </section>
      )}

      {tab === "atlas" && (
        <>
          <div className="atlas-grid">
            <AtlasIntro />
            <div className="atlas-center">
              <div className="atlas-crumb-row">
                <span className="atlas-breadcrumb" data-testid="atlas-breadcrumb">{crumb.join(" › ")}</span>
                <button type="button" className="list-view-toggle" aria-pressed={listView} onClick={() => setListView((v) => !v)}>List view</button>
              </div>
              {listView ? (
                <AtlasOutline view={view} selectedId={selectedId} onSelect={setSelectedId} />
              ) : (
                <AtlasGlobe view={view} selectedId={selectedId} onSelect={setSelectedId} />
              )}
              <AltitudeRail level={level} />
            </div>
            <AtlasDetail landmark={landmark} />
          </div>
          <div className="atlas-bottom">
            <CameraAltitudesTable view={view} onSelect={setSelectedId} />
            <div className="atlas-listview-panel">
              <h3>List view (outline)</h3>
              <AtlasOutline view={view} selectedId={selectedId} onSelect={setSelectedId} />
            </div>
          </div>
          <HowItWorks view={view} />
        </>
      )}

      {tab === "landscape" && (
        <section className="graphs">
          <LandscapeGraph doc={doc} />
        </section>
      )}

      {tab === "evidence" && (
        <section className="evidence-list" data-testid="evidence-list">
          <h2>Evidence</h2>
          <ul>
            {doc.evidence.map((e) => (
              <li key={e.id}>
                <strong>{e.claim}</strong> — {e.source} {e.verified ? "(verified)" : "(inferred)"}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="atlas-guarantees">
        {GUARANTEES.map(([t, d]) => (
          <div key={t} className="guarantee">
            <span className="guarantee-title">{t}</span>
            <span className="guarantee-desc">{d}</span>
          </div>
        ))}
        <div className="phase-badges"><span>Phase 1</span><span>Phase 2</span><span>Phase 3</span></div>
      </footer>
    </main>
  );
}
```

- [ ] **Step 5: Run the App test**

Run: `npm test --workspace @grasp/dashboard -- src/App.test.tsx`
Expected: PASS (4 tests). The globe path renders the fallback under jsdom, so `outline-node-*` buttons exist.

- [ ] **Step 6: Run the whole dashboard suite + tsc**

Run: `npm test --workspace @grasp/dashboard` then `npx tsc --noEmit -p packages/dashboard/tsconfig.json`
Expected: dashboard suite GREEN, `tsc` clean. (Add styles in `src/index.css` for the new classes — `.top-nav`, `.atlas-grid` [3-column grid], `.atlas-center`, `.atlas-detail`, `.atlas-intro`, `.atlas-outline`, `.altitude-rail`, `.atlas-bottom` [2-col], `.atlas-guarantees`, `.how-it-works` — matching the mockup zones; styling does not affect tests but is required to match `2026-06-09-grasp-atlas-ui.png`.)

- [ ] **Step 7: Commit**

```bash
git add packages/dashboard/src
git commit -m "feat(dashboard): three-zone Atlas shell + top nav + breadcrumb/altitude + Evidence tab"
```

---

## Task 9: Export atlas outline (`@grasp/export`)

**Files:**
- Create: `packages/export/src/atlasToMarkdown.ts`, `packages/export/src/atlasToHtml.ts`
- Modify: `packages/export/src/markdown.ts`, `packages/export/src/printHtml.ts`, `packages/export/src/svg.ts`, `packages/export/src/mermaid.ts`, `packages/export/src/index.ts`
- Test: `packages/export/src/__tests__/atlas.test.ts` (create), and update `svg.test.ts`, `mermaid.test.ts`, `markdown.test.ts`, `smoke.test.ts`, `security.test.ts`.

- [ ] **Step 1: Write the failing test**

Create `packages/export/src/__tests__/atlas.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateBrief } from "@grasp/schema";
import sample from "@grasp/schema/sample-brief.json";
import { atlasToMarkdown } from "../atlasToMarkdown";
import { atlasToHtml } from "../atlasToHtml";

const doc = validateBrief(sample).data!;

describe("atlasToMarkdown", () => {
  const md = atlasToMarkdown(doc);
  it("renders a heading per continent and bullets per landmark", () => {
    expect(md).toContain("### Architecture");
    expect(md).toContain("Schema validator");
    expect(md).toContain("#### Deterministic core");
  });
  it("escapes markdown link-breaking chars in hostile names", () => {
    const d = JSON.parse(JSON.stringify(sample));
    d.atlas.continents[0].cities[0].landmarks[0].name = "Evil ]( [x](javascript:alert(1))";
    const out = atlasToMarkdown(validateBrief(d).data!);
    expect(out).not.toContain("](javascript:");
  });
});

describe("atlasToHtml", () => {
  const html = atlasToHtml(doc);
  it("renders escaped section markup", () => {
    expect(html).toContain("<h3");
    expect(html).toContain("Schema validator");
  });
  it("entity-escapes hostile names", () => {
    const d = JSON.parse(JSON.stringify(sample));
    d.atlas.continents[0].title = "<script>x</script>";
    const out = atlasToHtml(validateBrief(d).data!);
    expect(out).toContain("&lt;script&gt;");
    expect(out).not.toContain("<script>x");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace @grasp/export -- src/__tests__/atlas.test.ts`
Expected: FAIL — modules do not exist.

- [ ] **Step 3: Implement the two renderers (reuse the dashboard view + outline)**

Create `packages/export/src/atlasToMarkdown.ts`:

```ts
import type { BriefDoc } from "@grasp/schema";

// Escape the four chars that break Markdown link/emphasis syntax in body text.
function mdText(s: string): string {
  return s.replace(/([\\`*_[\]()])/g, "\\$1");
}

export function atlasToMarkdown(doc: BriefDoc): string {
  const out: string[] = ["## How it works", ""];
  for (const c of doc.atlas.continents) {
    out.push(`### ${mdText(c.title)} — ${mdText(c.summary)}`, "");
    for (const city of c.cities) {
      out.push(`#### ${mdText(city.name)}`);
      if (city.summary) out.push(mdText(city.summary));
      for (const lm of city.landmarks) {
        const tech = lm.techTag ? ` (${mdText(lm.techTag)})` : "";
        const detail = lm.detail ? ` — ${mdText(lm.detail)}` : "";
        out.push(`- **${mdText(lm.name)}**${tech}${detail}`);
        if (lm.whyItMatters) out.push(`  - _Why it matters:_ ${mdText(lm.whyItMatters)}`);
      }
      out.push("");
    }
  }
  return `${out.join("\n")}\n`;
}
```

Create `packages/export/src/atlasToHtml.ts`:

```ts
import type { BriefDoc } from "@grasp/schema";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function atlasToHtml(doc: BriefDoc): string {
  const parts: string[] = [`<section class="atlas"><h2>How it works</h2>`];
  for (const c of doc.atlas.continents) {
    parts.push(`<article><h3>${esc(c.title)} <span class="continent">${esc(c.continentName ?? "")}</span></h3><p>${esc(c.summary)}</p>`);
    for (const city of c.cities) {
      parts.push(`<h4>${esc(city.name)}</h4><ul>`);
      for (const lm of city.landmarks) {
        const tech = lm.techTag ? ` <em>${esc(lm.techTag)}</em>` : "";
        const detail = lm.detail ? ` — ${esc(lm.detail)}` : "";
        const why = lm.whyItMatters ? `<div class="why">Why it matters: ${esc(lm.whyItMatters)}</div>` : "";
        parts.push(`<li><strong>${esc(lm.name)}</strong>${tech}${detail}${why}</li>`);
      }
      parts.push(`</ul>`);
    }
    parts.push(`</article>`);
  }
  parts.push(`</section>`);
  return parts.join("");
}
```

> `c.continentName` is not on `BriefDoc` (geography lives in the renderer). Drop the
> `<span class="continent">` line, OR import `CONTINENT_GEO` from
> `@grasp/dashboard/adapters` and use `CONTINENT_GEO[c.domain].continentName`. Use the
> import (DRY with the dashboard) and remove the `?? ""`.

- [ ] **Step 4: Wire into `markdown.ts` / `printHtml.ts`; drop concept svg/mermaid**

In `packages/export/src/markdown.ts`: remove `import { conceptToMermaid, landscapeToMermaid } from "./mermaid";` → `import { landscapeToMermaid } from "./mermaid";` and `import { atlasToMarkdown } from "./atlasToMarkdown";`. Replace the "Concept map" section (the lines pushing `"## Concept map"` + the ```` ```mermaid ```` `conceptToMermaid(doc)` block) with `out.push(atlasToMarkdown(doc));`. Keep the "Competitive landscape" Mermaid block.

In `packages/export/src/printHtml.ts`: remove `conceptToSvg` from the import (`import { landscapeToSvg } from "./svg";`) and add `import { atlasToHtml } from "./atlasToHtml";`. Replace the `<section><h2>Concept map</h2>${conceptToSvg(doc)}</section>` line with `${atlasToHtml(doc)}`. Keep the landscape SVG section.

In `packages/export/src/svg.ts`: delete `conceptToSvg` and its `CONCEPT_FILL`. Keep `landscapeToSvg`, `renderSvg`, `xml`.
In `packages/export/src/mermaid.ts`: delete `conceptToMermaid` and `CONCEPT_CLASSDEF`. Keep `landscapeToMermaid`, `label`, `nodeId`.
In `packages/export/src/index.ts`: add `export * from "./atlasToMarkdown";` and `export * from "./atlasToHtml";`.

- [ ] **Step 5: Update the existing export tests that referenced the concept graph**

In `svg.test.ts` and `mermaid.test.ts`: delete the `conceptToSvg`/`conceptToMermaid` `describe` blocks (keep the landscape ones). In `markdown.test.ts` and `smoke.test.ts`: replace any assertion about a "Concept map"/concept-mermaid section with an assertion that the markdown contains `## How it works` and a landmark name (e.g. `Schema validator`). In `security.test.ts`: keep landscape/mermaid escaping tests; the new atlas escaping is covered by `atlas.test.ts`.

- [ ] **Step 6: Run the export suite + tsc**

Run: `npm test --workspace @grasp/export` then `npx tsc --noEmit -p packages/export/tsconfig.json`
Expected: export suite GREEN, `tsc` clean.

- [ ] **Step 7: Commit**

```bash
git add packages/export/src
git commit -m "feat(export): atlasToMarkdown/atlasToHtml replace concept graph in report.md/html"
```

---

## Task 10: Full-suite verification + live re-render

**Files:** none (verification only)

- [ ] **Step 1: Whole monorepo green**

Run each: `npm test --workspace @grasp/schema`, `@grasp/pipeline`, `@grasp/dashboard`, `@grasp/export`.
Expected: ALL green. Then per-package `npx tsc --noEmit -p packages/<pkg>/tsconfig.json` — all clean.

- [ ] **Step 2: Rebuild the dashboard dist**

Run: `npm run build --workspace @grasp/dashboard`
Expected: vite build succeeds (bundle now includes three.js/globe.gl).

- [ ] **Step 3: Live re-render the golden sample → open**

```bash
T=$(mktemp -d)/repo && mkdir -p "$T/.grasp/fragments"
# reuse the schema golden sample as a ready brief to render:
npx tsx -e 'import {readFileSync,writeFileSync} from "node:fs"; const s=readFileSync("packages/schema/sample-brief.json","utf8"); writeFileSync(process.env.T+"/.grasp/dashboard-brief.json", s);' 2>/dev/null || true
# render via the export to confirm the non-WebGL path:
npx tsx packages/export/src/cli.ts packages/schema/sample-brief.json --format both --out "$T"
```
Expected: writes `report.md` (contains `## How it works`) + `report.html` (contains the escaped atlas sections), exit 0.

- [ ] **Step 4: Commit any build artifacts that are tracked**

`dist/` is gitignored, so there is nothing to commit here unless `package-lock.json` changed. If so:

```bash
git add package-lock.json
git commit -m "chore: lockfile after atlas Phase 1 deps"
```

- [ ] **Step 5: Final whole-branch review**

Dispatch the final code reviewer over the whole branch diff (`git diff main...HEAD`), focused on: schema referential rules, `buildAtlasView` determinism, the WebGL isolation (only `globeImpl.tsx` imports `react-globe.gl`), and per-grammar escaping in the export. Then proceed to **superpowers:finishing-a-development-branch**.

---

## Self-Review (run against the spec)

**Spec coverage:**
- §4 schema (atlas + errors) → Task 1; warning tier → Task 2. ✓
- §6 analyzer/assemble emit/merge atlas → Tasks 3–4. ✓
- §5 `buildAtlasView`/`AtlasView` spine → Task 5; AtlasOutline/HowItWorks/detail → Task 6; AtlasGlobe (lazy/fallback) + altitude rail → Task 7; three-zone layout + top nav + §5.1 mockup elements (intro, camera-altitudes table, breadcrumb, guarantees) → Task 8. ✓
- §7 export `atlasToMarkdown`/`atlasToHtml` (no flows) → Task 9. ✓
- §8 security escaping → Tasks 9 (export) + the globe/outline escape via React text nodes (auto-escaped). ✓
- §9 testing (deterministic data layer, mocked globe, fallback, click sequence, export escaping) → Tasks 5–9. ✓
- §10 Phase 1 scope (no flow arcs) → arcs `[]` in Task 5; flows omitted from export in Task 9. ✓

**Out of Phase 1 scope (correctly deferred):** flow arcs/Mermaid (Phase 2), `atlasToMermaid` (Phase 2), true point-in-polygon placement (using the deterministic ring now), sprites/idle-rotate/camera-easing (Phase 2). The globe's live camera/LOD flights are wired in `App.tsx`/`globeImpl` but only the fallback + selection are auto-tested (jsdom has no WebGL) — manual check in Task 10.

**Type consistency:** `AtlasView`/`ContinentView`/`CityView`/`LandmarkView`/`OutlineNode` defined in Task 5 are used unchanged in Tasks 6–9; `validateBrief().warnings` defined in Task 2 matches every later `validateBrief` consumer (existing callers ignore the new field — non-breaking). `CONTINENT_GEO` keys are the `atlasDomains` from Task 1.

**Placeholder scan:** none — every step has real code or an exact command.
