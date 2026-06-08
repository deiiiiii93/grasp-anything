# `/grasp` — Strategic Repo Understanding — Design

**Date:** 2026-06-08
**Status:** Approved (brainstorming), pending implementation plan
**Working name:** `grasp` (folder: `understand-as-project-manager`)

---

## 1. Summary

`/grasp` is a Claude Code plugin that reads any repository (local path or public
GitHub URL) and produces a **strategic brief**: an interactive HTML page that
answers five questions about the project, backed by two graphs.

The five questions:

1. **Idea** — what is the main idea?
2. **Problem** — what problem is it trying to deal with?
3. **Why it wins** — why does it succeed?
4. **How** — how does it realize the goal?
5. **Similar repos** — are there comparable projects, and how does this differ?

Positioning, in one line: *Understand-Anything tells an engineer how the code is
built; `/grasp` tells a product strategist why the project matters.*

It is explicitly modeled on [Understand-Anything](https://github.com/Lum1104/Understand-Anything),
reusing its proven separation of concerns — **LLM does judgment, deterministic
code does rendering, a JSON file is the contract between them** — but swapping the
*analysis lens* from technical (files, call graphs, layers) to conceptual
(claims, mechanisms, market position).

---

## 2. Goals & Non-Goals

### Goals
- One command turns a repo into a shareable, readable strategic brief.
- The brief is grounded: claims about "why it wins" and "similar repos" cite
  evidence where possible, and are clearly flagged as inferred when not.
- The user controls cost/accuracy via a **depth × broadness wizard** at runtime.
- Two interactive graphs: an inward **concept map** and an outward
  **competitive landscape**.
- **Incremental re-analysis**: re-running (or committing) only recomputes the
  parts whose evidence actually changed.

### Non-Goals (v1)
- Private-repo authentication.
- Internationalized / multi-language briefs.
- PDF / Markdown export.
- Cross-run result caching beyond incremental fingerprints.
- Comparing two repos side by side.

---

## 3. Architecture

Four layers, mirroring Understand-Anything's split. The load-bearing principle:
**the LLM produces judgment, deterministic code renders it, and
`repo-brief.json` is the only contract between the two halves.**

```
┌─ skills/grasp/SKILL.md ──────────── orchestrator (numbered phases + wizard)
│
├─ agents/*.md ───────────────────── LLM analyzers (judgment)
│     essence-analyzer    → idea / problem / how  (concept graph)
│     success-analyzer    → why it wins + evidence
│     landscape-analyzer  → similar repos (landscape graph)
│
├─ packages/schema/ ──────────────── repo-brief.json types + validator (contract)
│
└─ packages/dashboard/ ───────────── React/Vite app, PRE-BUILT to /dist, vendored
                                      (renders brief + both graphs; no runtime build)
```

**Chosen build strategy (Approach C — Hybrid):** the dashboard is a real
React/Vite app, but it is **built once at development time** and the compiled
`dist/` is vendored into the plugin. At runtime the skill never builds anything:
it writes `repo-brief.json` into `.grasp/` in the target repo, copies the
vendored `dashboard/dist` beside it, and opens the page. Polished UI, dumb
runtime.

**Why three agents, not one:** the five questions split along *evidence
boundaries*. Idea/problem/how come from inside the repo; why-it-wins needs
adoption signals; similar-repos needs outward web search. Splitting by evidence
source keeps each agent's context focused and prevents fabrication — an agent
that only sees the README cannot invent a competitive landscape, because that is
not its job. This split also makes incremental re-analysis trivial (see §7).

### Repo structure
```
understand-as-project-manager/
├── .claude-plugin/plugin.json      # plugin manifest
├── skills/grasp/SKILL.md           # the orchestrator
├── agents/
│   ├── essence-analyzer.md
│   ├── success-analyzer.md
│   └── landscape-analyzer.md
├── packages/
│   ├── schema/                     # TS types + validate.mjs + sample-brief.json
│   └── dashboard/                  # Vite app; `npm run build` → dist/ (vendored)
├── docs/superpowers/specs/         # this design doc
└── package.json                    # workspace root
```

---

## 4. Data Contract — `repo-brief.json`

Everything the agents produce funnels into one validated file. The dashboard
reads **only** this file — it never touches the repo.

```jsonc
{
  "meta": {
    "repo": "Lum1104/Understand-Anything",
    "url": "https://github.com/...",
    "analyzedAt": "2026-06-08T12:00:00Z",
    "depth": "skim",          // docs | skim | deep   (from wizard)
    "broadness": "web",       // offline | web        (from wizard)
    "signals": { "stars": 1234, "lastCommit": "...", "language": "TypeScript" }
  },

  "brief": {                  // the 5 answers, as readable prose (HTML body)
    "idea":     "1–2 sentence thesis",
    "problem":  "what pain it removes + who has it",
    "why":      "why it succeeds (grounded in evidence[])",
    "how":      "the mechanism, in plain language",
    "takeaway": "one-line 'should I care?' verdict",
    "updatedAt": {            // per-section freshness for incremental runs
      "essence": "2026-06-08T12:00:00Z",   // idea/problem/how
      "success": "2026-06-08T12:00:00Z",   // why
      "landscape": "2026-06-08T12:00:00Z"
    }
  },

  "conceptGraph":   { "nodes": [...], "edges": [...] },   // inward
  "landscapeGraph": { "nodes": [...], "edges": [...] },   // outward

  "evidence": [               // every 'why'/'landscape' claim can cite a source
    { "id": "e1", "claim": "...", "source": "GitHub stars", "url": "...",
      "verified": true }      // false when broadness=offline / inferred
  ]
}
```

`evidence[]` is the trust backbone: nodes and prose claims reference evidence ids
so the HTML can render footnotes/tooltips. When `broadness: offline`, evidence is
sparse and `verified: false`; the UI flags such claims as "inferred, not
verified."

### Concept graph (inward)
Typed nodes so the renderer can apply a visual grammar (color/shape by meaning):

| Node `type` | Meaning | Example |
|---|---|---|
| `problem` | the pain | "Codebases are hard to onboard into" |
| `idea` | core thesis (single root) | "Turn a repo into a knowledge graph" |
| `mechanism` | how (the *how* question) | "LLM agents emit a validated JSON graph" |
| `outcome` | what you get | "Interactive architecture dashboard" |
| `feature` | notable capability | "Incremental graph updates on commit" |

Node shape: `{ id, type, label, detail, evidenceIds: [] }`.
Edge `type`: `addresses` (idea→problem), `composedOf` (idea→mechanism),
`enables` (mechanism→outcome), `produces` (mechanism→feature).
Edge shape: `{ id, source, target, type }`. Exactly one `idea` node anchors the
graph; layout fans mechanisms/outcomes outward.

### Landscape graph (outward)

| Node `type` | Meaning |
|---|---|
| `self` | the analyzed repo (visually distinct, center) |
| `alternative` | a similar/competing repo |
| `category` | a niche label nodes cluster under |

`alternative` node carries
`{ id, type, name, url, stars, oneLiner, similarity: 0–1, differentiator, evidenceIds }`.
Edge `type`: `competesWith`, `sharesApproach`, `alternativeTo`.
Layout = force-directed by `similarity` (closer = more similar), clustered by
`category`. Answers "are there similar repos" *and* "how is this different" in one
view.

### Validation rules (enforced by `packages/schema`)
- All five `brief.*` prose fields present and non-empty.
- Exactly one `conceptGraph` node of type `idea`.
- Every edge `source`/`target` references an existing node id.
- Every `evidenceIds` entry references an existing `evidence[].id`.
- Exactly one `landscapeGraph` node of type `self`.
- Every node `type` / edge `type` is from the allowed enum.

---

## 5. The HTML Report

A single scrollable page rendered by the vendored dashboard, three zones:

1. **Header** — repo name, the `takeaway` verdict, signal chips (stars, language,
   depth/broadness badges).
2. **The Brief** — five prose cards (Idea · Problem · Why it wins · How ·
   Takeaway), with inline evidence tooltips; unverified claims visibly marked.
3. **The Two Graphs** — tabbed or stacked: Concept map and Landscape,
   interactive (hover a node → detail + evidence; click an `alternative` → opens
   its GitHub).

Deliberate redundancy: the same `how` exists as prose (`brief.how`) **and** as
structure (`mechanism` nodes). Prose is for skimming; the graph is for exploring.
Two encodings of one truth, kept side by side rather than derived.

---

## 6. Runtime Flow

### The wizard (Phase 0)
On invocation, two questions before any work — the depth × broadness axes —
with defaults pre-selected (`skim` × `web`):

```
① How deep should I read the code?
   • docs   — README, docs, manifests only        (fastest)
   • skim   — + entry points & core files          (recommended)
   • deep   — + trace the full implementation       (slowest)

② How wide should I look?
   • offline — only what's in the repo              (private/fast)
   • web     — + search for adoption & similar repos (recommended)
```

A bare `/grasp` (no target) defaults to the current directory.

### Phases
```
Phase 0    Resolve target + run wizard
           · GitHub URL → shallow clone to temp (or API-only if clone fails)
           · local path → use in place
Phase 0.5  Staleness check (incremental — see §7)
           · compute fingerprints, diff against .grasp/state.json
           · mark each evidence stream fresh/stale
Phase 1    Gather sources  [conditioned on depth × broadness]
           · always: README, docs/, manifests, file tree, git signals
           · skim/deep: read entry points / core files
           · web: fetch GitHub stars/issues, search "alternatives to X"
Phase 2    Dispatch agents (parallel where independent; stale streams only)
           · essence-analyzer   → conceptGraph + brief.{idea,problem,how}
           · success-analyzer   → brief.why + evidence[]
           · landscape-analyzer → landscapeGraph   (skipped if offline)
Phase 3    Assemble repo-brief.json → run schema validator → repair if invalid
Phase 4    Write .grasp/repo-brief.json, copy vendored dashboard/dist beside it,
           open in browser
```

---

## 7. Incremental Re-analysis

Change units are **evidence sources**, not files. The brief has three evidence
streams, each owned by exactly one agent — so "what changed → what to recompute"
is a clean lookup with no overlap.

```
change in …          → re-run only …      → updates …
──────────────────────────────────────────────────────────────────────
README / docs / code → essence-analyzer   → conceptGraph + brief.{idea,problem,how}
git signals (stars,  → success-analyzer   → brief.why + evidence[]
  issues, activity)
landscape is market-stable: refreshed only on explicit --refresh-landscape
  or when broadness changes (a commit doesn't change who the competitors are)
```

**Mechanism:**
- **Fingerprints** — after each run, store per-stream state in `.grasp/state.json`:
  - `docsHash` — hash of README + docs + manifests
  - `codeHash` — hash of the set of files actually read (respecting depth)
  - `signalsSnapshot` — stars / lastCommit / issue counts
- **Staleness check (Phase 0.5)** — recompute hashes, diff against `state.json`,
  mark each stream fresh/stale. Only stale streams' agents run; the rest of
  `repo-brief.json` is preserved and merged. `meta.analyzedAt` bumps;
  `brief.updatedAt.*` records per-section freshness.
- **`--auto-update`** — writes `.grasp/config.json { autoUpdate: true }` and
  installs a `post-commit` git hook that re-runs `/grasp` in incremental mode.
  `--no-auto-update` removes the hook.
- **`--full`** — ignores fingerprints, regenerates everything.

This is cheap precisely because agents are split by evidence source (§3): the
streams don't ripple into each other, so staleness is three independent hash
comparisons — no `change-classifier` dependency-graph machinery needed.

---

## 8. Error Handling

| Situation | Behavior |
|---|---|
| Target missing / not a repo | Stop with a clear message (pre-flight, like UA). |
| GitHub clone fails (no network/private) | Fall back to README/metadata via API; if that fails too, stop and explain. |
| `broadness: web` but search unavailable | Degrade to offline; banner: "landscape inferred from prior knowledge, not verified." |
| Agent returns invalid JSON | One repair pass against the validator; if still bad, write a partial brief + warning. |
| Huge repo at `deep` | Cap files analyzed; note the cap in `meta`. |
| `.grasp/state.json` missing/corrupt | Treat as a full run (all streams stale). |

---

## 9. Testing

Kept light, in the spirit of UA's `core` tests.

- **Schema validator unit tests** — valid sample passes; malformed briefs
  (missing `idea`, bad edge `type`, dangling evidence ref, two `idea` nodes,
  no `self` node) each fail with a clear error.
- **Golden sample** `packages/schema/sample-brief.json` — committed, used both as
  a test fixture *and* as the dashboard's dev data, so the UI can be built before
  the pipeline exists.
- **Dashboard smoke test** — renders the golden sample without crashing (both
  graphs draw, all five cards present, unverified-claim flag shows).
- **Incremental test** — given a `state.json` + an unchanged repo, assert no agent
  runs; change `docsHash`, assert only essence re-runs.

The golden sample doing double duty (fixture + dashboard dev-data) lets the
dashboard and the pipeline be built **in parallel against the same contract**,
and de-risks the hardest part first: if a hand-written perfect brief doesn't
render beautifully, no agent tuning will save it.

---

## 10. Build Sequence (suggested)

1. `packages/schema` — types, validator, golden `sample-brief.json`, tests.
2. `packages/dashboard` — React/Vite app against the golden sample; build → `dist/`.
3. `agents/*` — the three analyzer prompts, each emitting its slice of the brief.
4. `skills/grasp/SKILL.md` — orchestrator: wizard, phases, assembly, validation, render.
5. Incremental layer — fingerprints, `state.json`, Phase 0.5, `--auto-update` hook, `--full`.
6. `.claude-plugin/plugin.json` + wiring; end-to-end run on a real public repo.

Steps 1–2 and 3 can proceed in parallel once the schema (step 1) is fixed.

---

## 11. Open Contract Decisions (raised by Plan 1 final review)

Plan 1 (`packages/schema`) is implemented and validated. Its final review surfaced
contract questions to resolve **before Plan 2 (dashboard) starts**, since they may
alter `repo-brief.json`. All are additive/optional, so deferring is safe, but the
choice should be conscious:

1. **Evidence on prose claims (highest priority).** §4/§5 promise "inline evidence
   tooltips" on the five `brief.*` prose cards, but the contract currently attaches
   `evidenceIds` only to graph nodes — the `brief` object has no evidence-reference
   field. Decide before Plan 2 whether prose cards cite evidence directly (e.g. add
   optional `brief.evidence: { idea?: string[], why?: string[], ... }`) or tooltips
   key off graph nodes only. This is the most likely future breaking change.
2. **`category` linkage is an unchecked free string.** `self`/`alternative` nodes
   carry `category: "cat1"`, but no cross-field rule requires it to resolve to an
   existing `category`-type node (unlike edges/evidence, which are checked). Add a
   reference check if Plan 2's clustering needs the guarantee.
3. **Timestamps validated as non-empty strings, not ISO datetimes.** `meta.analyzedAt`
   and `brief.updatedAt.*` use `z.string().min(1)`. Plan 4 compares these for
   freshness — consider tightening to `z.string().datetime()` then (note `meta.signals.lastCommit`
   is intentionally date-only and must stay loose).
4. **`LandscapeNode` is one permissive object** (all type-specific fields optional,
   required fields enforced via `superRefine`). Downstream code must not infer field
   absence from node `type`. A discriminated union is the stricter alternative if this
   becomes error-prone.
