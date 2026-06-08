# `/grasp` Incremental Re-analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make re-running `/grasp` cheap — only the evidence streams whose inputs actually changed get recomputed — by adding deterministic fingerprinting, a per-stream staleness check, persisted state, per-section freshness timestamps, and an `--auto-update` git hook.

**Architecture:** Three evidence streams, each owned by one agent, are fingerprinted independently (docs/code → essence; signals → success; landscape is market-stable). After each run, per-stream content hashes are stored in `.grasp/state.json`. On re-run, a deterministic `grasp-state` command recomputes hashes, diffs against the stored state, and reports which streams are stale; the orchestrator re-dispatches **only** those agents (overwriting only their fragment files in `.grasp/fragments/`), then re-assembles. Fresh streams' fragment files — and their `brief.updatedAt` timestamps — are preserved untouched. This stays cheap precisely because the streams don't ripple into each other (spec §7): staleness is three independent hash comparisons, no dependency-graph machinery.

**Tech Stack:** TypeScript (no build; `tsx`), Zod (`@grasp/schema` + `@grasp/pipeline`), Node `crypto`/`fs`, Vitest. Extends the existing `packages/pipeline` workspace from Plan 3.

---

## Design decisions resolved in this plan

The spec (§6–§8) describes incremental re-analysis but leaves the mechanics to implementation. This plan locks them:

1. **State stores content hashes, not raw snapshots.** `.grasp/state.json` holds `docsHash`, `codeHash`, `signalsHash`, `broadness`, and a `version`. Staleness only needs equality, so hashes suffice and keep the file tiny. (Spec §7 says "signalsSnapshot — stars/lastCommit/issue counts"; a hash of exactly those is equivalent for detecting change.)
2. **Fragments + meta persist in `.grasp/fragments/` between runs; incremental = re-run only stale agents.** A fresh stream keeps its existing fragment file, which `grasp-assemble` reads unchanged — so preserving *content* needs no brief-splitting/inverse-assemble. Only *timestamps* need special handling (see #3).
3. **Per-stream `brief.updatedAt` is preserved for fresh streams.** `grasp-assemble` gains `--prior <priorBriefPath>` and `--stale <comma-list>`. For each of the three streams *not* in `--stale`, it copies the prior brief's `updatedAt.<stream>`; stale streams (and first/full runs, where `--prior` is absent) get `meta.analyzedAt`. The brief-level mechanism is an optional `updatedAt` override on `assemble()`.
4. **The `--auto-update` git hook flags staleness; it does not autonomously regenerate.** A `post-commit` hook cannot drive LLM agents, so it runs `grasp-state --dry-run` (recompute + report staleness **without** writing state) and prints which streams changed and a reminder to run `/grasp`. It must not consume fingerprints — only a real run updates `state.json` — otherwise the next manual run would see nothing stale.
5. **Missing/corrupt/old `state.json` → full run.** `readState` returns `null` on absent file, unparseable JSON, or schema mismatch (spec §8); `diffStaleness(null, …)` marks every stream stale.

---

## File structure

```
packages/pipeline/
├── package.json                       # MODIFY — add grasp-state + grasp-autoupdate bins
└── src/
    ├── state.ts                        # NEW — GraspState schema + read/write (.grasp/state.json)
    ├── fingerprint.ts                  # NEW — hashFiles, hashSignals
    ├── staleness.ts                    # NEW — diffStaleness(prior, next, opts)
    ├── state-run.ts                    # NEW — runState(argv): the grasp-state CLI logic
    ├── state-cli.ts                    # NEW — #!/usr/bin/env tsx bin wrapper
    ├── autoupdate.ts                   # NEW — install/removeAutoUpdate (config.json + post-commit hook)
    ├── autoupdate-cli.ts               # NEW — bin wrapper
    ├── assemble.ts                     # MODIFY — optional per-stream updatedAt override
    ├── cli-run.ts                      # MODIFY — --prior / --stale → resolve updatedAt override
    ├── index.ts                        # MODIFY — export new modules
    └── __tests__/
        ├── state.test.ts
        ├── fingerprint.test.ts
        ├── staleness.test.ts
        ├── state-cli.test.ts
        ├── assemble-incremental.test.ts
        ├── cli-incremental.test.ts
        └── autoupdate.test.ts

skills/grasp/SKILL.md                   # MODIFY — Phase 0.5 + incremental flags
packages/pipeline/src/__tests__/skill-contract.test.ts   # MODIFY — assert new tokens
```

---

## Task 1: `state.ts` — persist and read `.grasp/state.json`

**Files:**
- Create: `packages/pipeline/src/state.ts`
- Modify: `packages/pipeline/src/index.ts`
- Test: `packages/pipeline/src/__tests__/state.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/pipeline/src/__tests__/state.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readState, writeState, statePath, type GraspState } from "../state";

const sample: GraspState = {
  version: 1,
  docsHash: "d",
  codeHash: "c",
  signalsHash: "s",
  broadness: "web",
};

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "grasp-state-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("state", () => {
  it("round-trips through write then read", () => {
    writeState(dir, sample);
    expect(readState(dir)).toEqual(sample);
  });

  it("writes to <dir>/.grasp/state.json", () => {
    writeState(dir, sample);
    expect(statePath(dir)).toBe(join(dir, ".grasp", "state.json"));
  });

  it("returns null when state is missing", () => {
    expect(readState(dir)).toBeNull();
  });

  it("returns null on corrupt JSON (treated as a full run)", () => {
    mkdirSync(join(dir, ".grasp"), { recursive: true });
    writeFileSync(statePath(dir), "{ not json", "utf8");
    expect(readState(dir)).toBeNull();
  });

  it("returns null on a schema mismatch / old version", () => {
    mkdirSync(join(dir, ".grasp"), { recursive: true });
    writeFileSync(statePath(dir), JSON.stringify({ version: 0 }), "utf8");
    expect(readState(dir)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test --workspace @grasp/pipeline`
Expected: FAIL with "Cannot find module '../state'".

- [ ] **Step 3: Implement `state.ts`**

`packages/pipeline/src/state.ts`:

```ts
import { z } from "zod";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const GraspStateSchema = z.object({
  version: z.literal(1),
  docsHash: z.string(),
  codeHash: z.string(),
  signalsHash: z.string(),
  broadness: z.enum(["offline", "web"]),
});

export type GraspState = z.infer<typeof GraspStateSchema>;

export function statePath(targetDir: string): string {
  return join(targetDir, ".grasp", "state.json");
}

/** Reads prior state. Returns null on missing / unparseable / schema-mismatched files — all treated as "no prior", i.e. a full run (spec §8). */
export function readState(targetDir: string): GraspState | null {
  const path = statePath(targetDir);
  if (!existsSync(path)) return null;
  try {
    const parsed = GraspStateSchema.safeParse(JSON.parse(readFileSync(path, "utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function writeState(targetDir: string, state: GraspState): void {
  const path = statePath(targetDir);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}
```

- [ ] **Step 4: Export from the index.** Add to `packages/pipeline/src/index.ts`:

```ts
export * from "./state";
```

- [ ] **Step 5: Run the tests.** `npm test --workspace @grasp/pipeline` → PASS.
- [ ] **Step 6: Typecheck.** `npm run typecheck --workspace @grasp/pipeline` → clean.
- [ ] **Step 7: Commit**

```bash
git add packages/pipeline/src/state.ts packages/pipeline/src/index.ts packages/pipeline/src/__tests__/state.test.ts
git commit -m "feat(pipeline): .grasp/state.json schema with corrupt-tolerant read"
```

---

## Task 2: `fingerprint.ts` — hash docs, code, and signals

**Files:**
- Create: `packages/pipeline/src/fingerprint.ts`
- Modify: `packages/pipeline/src/index.ts`
- Test: `packages/pipeline/src/__tests__/fingerprint.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/pipeline/src/__tests__/fingerprint.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashFiles, hashSignals } from "../fingerprint";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "grasp-fp-"));
  mkdirSync(join(dir, "docs"), { recursive: true });
  writeFileSync(join(dir, "README.md"), "hello");
  writeFileSync(join(dir, "docs", "a.md"), "world");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("hashFiles", () => {
  it("is stable for identical content", () => {
    expect(hashFiles(dir, ["README.md", "docs/a.md"])).toBe(
      hashFiles(dir, ["README.md", "docs/a.md"]),
    );
  });

  it("is order-independent", () => {
    expect(hashFiles(dir, ["README.md", "docs/a.md"])).toBe(
      hashFiles(dir, ["docs/a.md", "README.md"]),
    );
  });

  it("changes when a file's content changes", () => {
    const before = hashFiles(dir, ["README.md"]);
    writeFileSync(join(dir, "README.md"), "HELLO");
    expect(hashFiles(dir, ["README.md"])).not.toBe(before);
  });

  it("changes when the set of files changes", () => {
    expect(hashFiles(dir, ["README.md"])).not.toBe(
      hashFiles(dir, ["README.md", "docs/a.md"]),
    );
  });

  it("tolerates a missing file deterministically", () => {
    expect(hashFiles(dir, ["nope.md"])).toBe(hashFiles(dir, ["nope.md"]));
  });
});

describe("hashSignals", () => {
  it("is independent of key order", () => {
    expect(hashSignals({ stars: 10, language: "TS" })).toBe(
      hashSignals({ language: "TS", stars: 10 }),
    );
  });

  it("changes when a value changes", () => {
    expect(hashSignals({ stars: 10 })).not.toBe(hashSignals({ stars: 11 }));
  });

  it("treats undefined as an empty object", () => {
    expect(hashSignals(undefined)).toBe(hashSignals({}));
  });
});
```

- [ ] **Step 2: Run to verify it fails** ("Cannot find module '../fingerprint'"): `npm test --workspace @grasp/pipeline`

- [ ] **Step 3: Implement `fingerprint.ts`**

`packages/pipeline/src/fingerprint.ts`:

```ts
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Order-independent content hash of a set of files (paths relative to targetDir).
 * A missing file hashes to a fixed sentinel so the result stays deterministic.
 */
export function hashFiles(targetDir: string, relPaths: string[]): string {
  const lines = [...relPaths]
    .sort()
    .map((rel) => {
      const abs = join(targetDir, rel);
      const content = existsSync(abs) ? readFileSync(abs, "utf8") : " missing";
      return `${rel}\n${sha256(content)}`;
    });
  return sha256(lines.join("\n"));
}

/** Stable hash of signals, independent of key order. */
export function hashSignals(signals: Record<string, unknown> | undefined): string {
  const obj = signals ?? {};
  const sortedKeys = Object.keys(obj).sort();
  return sha256(JSON.stringify(obj, sortedKeys));
}
```

- [ ] **Step 4: Export from the index.** Add to `packages/pipeline/src/index.ts`:

```ts
export * from "./fingerprint";
```

- [ ] **Step 5: Run the tests** → PASS.
- [ ] **Step 6: Typecheck** → clean.
- [ ] **Step 7: Commit**

```bash
git add packages/pipeline/src/fingerprint.ts packages/pipeline/src/index.ts packages/pipeline/src/__tests__/fingerprint.test.ts
git commit -m "feat(pipeline): content fingerprints for docs, code, and signals"
```

---

## Task 3: `staleness.ts` — diff fingerprints into a per-stream verdict

**Files:**
- Create: `packages/pipeline/src/staleness.ts`
- Modify: `packages/pipeline/src/index.ts`
- Test: `packages/pipeline/src/__tests__/staleness.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/pipeline/src/__tests__/staleness.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { diffStaleness, type Fingerprints } from "../staleness";
import type { GraspState } from "../state";

const prior: GraspState = {
  version: 1,
  docsHash: "d",
  codeHash: "c",
  signalsHash: "s",
  broadness: "web",
};
const same: Fingerprints = { docsHash: "d", codeHash: "c", signalsHash: "s", broadness: "web" };

describe("diffStaleness", () => {
  it("marks everything stale on a first run (no prior)", () => {
    expect(diffStaleness(null, same)).toEqual({
      essence: true,
      success: true,
      landscape: true,
      firstRun: true,
    });
  });

  it("marks everything stale with --full", () => {
    const r = diffStaleness(prior, same, { full: true });
    expect(r.essence && r.success && r.landscape).toBe(true);
    expect(r.firstRun).toBe(false);
  });

  it("marks nothing stale when nothing changed", () => {
    expect(diffStaleness(prior, same)).toEqual({
      essence: false,
      success: false,
      landscape: false,
      firstRun: false,
    });
  });

  it("marks only essence stale when docs change", () => {
    const r = diffStaleness(prior, { ...same, docsHash: "d2" });
    expect(r).toMatchObject({ essence: true, success: false, landscape: false });
  });

  it("marks only essence stale when code changes", () => {
    const r = diffStaleness(prior, { ...same, codeHash: "c2" });
    expect(r).toMatchObject({ essence: true, success: false, landscape: false });
  });

  it("marks only success stale when signals change", () => {
    const r = diffStaleness(prior, { ...same, signalsHash: "s2" });
    expect(r).toMatchObject({ essence: false, success: true, landscape: false });
  });

  it("marks landscape stale only on broadness change or --refresh-landscape", () => {
    expect(diffStaleness(prior, { ...same, broadness: "offline" }).landscape).toBe(true);
    expect(diffStaleness(prior, same, { refreshLandscape: true }).landscape).toBe(true);
    // a docs change alone must NOT refresh the (market-stable) landscape
    expect(diffStaleness(prior, { ...same, docsHash: "d2" }).landscape).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails** ("Cannot find module '../staleness'"): `npm test --workspace @grasp/pipeline`

- [ ] **Step 3: Implement `staleness.ts`**

`packages/pipeline/src/staleness.ts`:

```ts
import type { GraspState } from "./state";

export interface Fingerprints {
  docsHash: string;
  codeHash: string;
  signalsHash: string;
  broadness: "offline" | "web";
}

export interface StalenessOptions {
  refreshLandscape?: boolean;
  full?: boolean;
}

export interface Staleness {
  essence: boolean;
  success: boolean;
  landscape: boolean;
  firstRun: boolean;
}

/**
 * Per-stream staleness. Streams are independent (spec §7):
 *  - essence   ← docs or code changed
 *  - success   ← signals changed
 *  - landscape ← market-stable: only a broadness change or an explicit refresh
 * A first run or --full forces everything stale.
 */
export function diffStaleness(
  prior: GraspState | null,
  next: Fingerprints,
  opts: StalenessOptions = {},
): Staleness {
  const firstRun = prior === null;
  if (firstRun || opts.full) {
    return { essence: true, success: true, landscape: true, firstRun };
  }
  return {
    essence: prior.docsHash !== next.docsHash || prior.codeHash !== next.codeHash,
    success: prior.signalsHash !== next.signalsHash,
    landscape: Boolean(opts.refreshLandscape) || prior.broadness !== next.broadness,
    firstRun,
  };
}
```

- [ ] **Step 4: Export from the index.** Add to `packages/pipeline/src/index.ts`:

```ts
export * from "./staleness";
```

- [ ] **Step 5: Run the tests** → PASS.
- [ ] **Step 6: Typecheck** → clean.
- [ ] **Step 7: Commit**

```bash
git add packages/pipeline/src/staleness.ts packages/pipeline/src/index.ts packages/pipeline/src/__tests__/staleness.test.ts
git commit -m "feat(pipeline): per-stream staleness diff (essence/success/landscape)"
```

---

## Task 4: `grasp-state` CLI — the Phase 0.5 command

**Files:**
- Create: `packages/pipeline/src/state-run.ts`
- Create: `packages/pipeline/src/state-cli.ts`
- Modify: `packages/pipeline/package.json` (add bin)
- Test: `packages/pipeline/src/__tests__/state-cli.test.ts`

The orchestrator calls this in Phase 0.5. It reads a **sources manifest** the orchestrator wrote in Phase 1 — `{ docs: string[], code: string[], signals: {...}, broadness }` (paths relative to the target) — computes fingerprints, diffs against prior `state.json`, prints the staleness verdict as JSON to stdout, and (unless `--dry-run`) writes the new `state.json`.

- [ ] **Step 1: Write the failing test**

`packages/pipeline/src/__tests__/state-cli.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runState } from "../state-run";
import { statePath } from "../state";

let dir: string;
let sources: string;

function writeSources(obj: unknown) {
  writeFileSync(sources, JSON.stringify(obj), "utf8");
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "grasp-statecli-"));
  sources = join(dir, "sources.json");
  mkdirSync(join(dir, "docs"), { recursive: true });
  writeFileSync(join(dir, "README.md"), "readme v1");
  writeFileSync(join(dir, "src.ts"), "code v1");
  writeSources({
    docs: ["README.md"],
    code: ["src.ts"],
    signals: { stars: 100 },
    broadness: "web",
  });
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function capture(): { out: string[]; restore: () => void } {
  const out: string[] = [];
  const spy = vi.spyOn(console, "log").mockImplementation((m) => out.push(String(m)));
  return { out, restore: () => spy.mockRestore() };
}

describe("runState", () => {
  it("first run: reports all stale and writes state.json", () => {
    const { out, restore } = capture();
    const code = runState(["--target", dir, "--sources", sources]);
    restore();
    expect(code).toBe(0);
    expect(existsSync(statePath(dir))).toBe(true);
    const verdict = JSON.parse(out[0]);
    expect(verdict).toMatchObject({ essence: true, success: true, landscape: true, firstRun: true });
  });

  it("second run with no changes: reports nothing stale", () => {
    runState(["--target", dir, "--sources", sources]);
    const { out, restore } = capture();
    const code = runState(["--target", dir, "--sources", sources]);
    restore();
    expect(code).toBe(0);
    expect(JSON.parse(out[0])).toMatchObject({ essence: false, success: false, landscape: false });
  });

  it("re-run after a docs change: only essence stale", () => {
    runState(["--target", dir, "--sources", sources]);
    writeFileSync(join(dir, "README.md"), "readme v2");
    const { out, restore } = capture();
    runState(["--target", dir, "--sources", sources]);
    restore();
    expect(JSON.parse(out[0])).toMatchObject({ essence: true, success: false, landscape: false });
  });

  it("--dry-run reports staleness but does NOT write state.json", () => {
    const { out, restore } = capture();
    const code = runState(["--target", dir, "--sources", sources, "--dry-run"]);
    restore();
    expect(code).toBe(0);
    expect(existsSync(statePath(dir))).toBe(false);
    expect(JSON.parse(out[0]).firstRun).toBe(true);
  });

  it("--full forces all stale even when nothing changed", () => {
    runState(["--target", dir, "--sources", sources]);
    const { out, restore } = capture();
    runState(["--target", dir, "--sources", sources, "--full"]);
    restore();
    expect(JSON.parse(out[0])).toMatchObject({ essence: true, success: true, landscape: true });
  });

  it("exits 2 on missing flags", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(runState(["--target", dir])).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify it fails** ("Cannot find module '../state-run'"): `npm test --workspace @grasp/pipeline`

- [ ] **Step 3: Implement the CLI logic** at `packages/pipeline/src/state-run.ts`:

```ts
import { readFileSync } from "node:fs";
import { hashFiles, hashSignals } from "./fingerprint";
import { diffStaleness, type Fingerprints } from "./staleness";
import { readState, writeState } from "./state";

interface Args {
  target?: string;
  sources?: string;
  refreshLandscape?: boolean;
  full?: boolean;
  dryRun?: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--target") args.target = argv[++i];
    else if (a === "--sources") args.sources = argv[++i];
    else if (a === "--refresh-landscape") args.refreshLandscape = true;
    else if (a === "--full") args.full = true;
    else if (a === "--dry-run") args.dryRun = true;
  }
  return args;
}

interface Sources {
  docs: string[];
  code: string[];
  signals: Record<string, unknown>;
  broadness: "offline" | "web";
}

/** Exit code: 0 ok, 2 usage/IO error. Prints the staleness verdict (JSON) to stdout. */
export function runState(argv: string[]): number {
  const { target, sources, refreshLandscape, full, dryRun } = parseArgs(argv);
  if (!target || !sources) {
    console.error("usage: grasp-state --target <dir> --sources <sources.json> [--refresh-landscape] [--full] [--dry-run]");
    return 2;
  }

  let parsed: Sources;
  try {
    parsed = JSON.parse(readFileSync(sources, "utf8")) as Sources;
  } catch (err) {
    console.error(`Cannot read sources ${sources}: ${(err as Error).message}`);
    return 2;
  }

  const next: Fingerprints = {
    docsHash: hashFiles(target, parsed.docs ?? []),
    codeHash: hashFiles(target, parsed.code ?? []),
    signalsHash: hashSignals(parsed.signals),
    broadness: parsed.broadness,
  };

  const prior = readState(target);
  const staleness = diffStaleness(prior, next, { refreshLandscape, full });

  if (!dryRun) {
    writeState(target, { version: 1, ...next });
  }

  console.log(JSON.stringify(staleness));
  return 0;
}
```

- [ ] **Step 4: Implement the bin wrapper** at `packages/pipeline/src/state-cli.ts`:

```ts
#!/usr/bin/env tsx
import { runState } from "./state-run";

process.exit(runState(process.argv.slice(2)));
```

- [ ] **Step 5: Register the bin.** In `packages/pipeline/package.json`, change the `bin` block to:

```json
  "bin": {
    "grasp-assemble": "src/cli.ts",
    "grasp-state": "src/state-cli.ts"
  },
```

- [ ] **Step 6: Run the tests** → PASS.
- [ ] **Step 7: Typecheck** → clean.
- [ ] **Step 8: Commit**

```bash
git add packages/pipeline/src/state-run.ts packages/pipeline/src/state-cli.ts packages/pipeline/package.json packages/pipeline/src/__tests__/state-cli.test.ts
git commit -m "feat(pipeline): grasp-state CLI (Phase 0.5 staleness check + state.json)"
```

---

## Task 5: per-stream `updatedAt` override in `assemble()`

**Files:**
- Modify: `packages/pipeline/src/assemble.ts`
- Test: `packages/pipeline/src/__tests__/assemble-incremental.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/pipeline/src/__tests__/assemble-incremental.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateBrief } from "@grasp/schema";
import { assemble } from "../assemble";
import meta from "./fixtures/meta.json";
import essence from "./fixtures/essence.json";
import success from "./fixtures/success.json";
import landscape from "./fixtures/landscape.json";

const ANALYZED_AT = "2026-06-08T12:00:00Z"; // == meta.json analyzedAt
const OLD = "2026-01-01T00:00:00Z";

describe("assemble with per-stream updatedAt override", () => {
  it("defaults every stream to meta.analyzedAt when no override is given", () => {
    const r = assemble({ meta, essence, success, landscape });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.brief.updatedAt).toEqual({
      essence: ANALYZED_AT,
      success: ANALYZED_AT,
      landscape: ANALYZED_AT,
    });
  });

  it("preserves overridden streams and keeps the rest at meta.analyzedAt", () => {
    const r = assemble({
      meta,
      essence,
      success,
      landscape,
      updatedAt: { success: OLD, landscape: OLD },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.brief.updatedAt).toEqual({
      essence: ANALYZED_AT,
      success: OLD,
      landscape: OLD,
    });
    expect(validateBrief(r.doc).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails** (the second test fails — `updatedAt` is ignored, so `success`/`landscape` are still `ANALYZED_AT`): `npm test --workspace @grasp/pipeline`

- [ ] **Step 3: Implement the override.** In `packages/pipeline/src/assemble.ts`:

Add an optional field to `AssembleInput` (after the `landscape?: unknown;` line):

```ts
  /** Per-stream timestamp overrides; each present key replaces meta.analyzedAt. Lets incremental runs preserve fresh streams' prior brief.updatedAt. */
  updatedAt?: { essence?: string; success?: string; landscape?: string };
```

Replace the `updatedAt:` block inside the `doc` literal with:

```ts
      updatedAt: {
        essence: input.updatedAt?.essence ?? meta.analyzedAt,
        success: input.updatedAt?.success ?? meta.analyzedAt,
        landscape: input.updatedAt?.landscape ?? meta.analyzedAt,
      },
```

- [ ] **Step 4: Run the tests** → PASS (the new file plus the unchanged Plan-3 `assemble.test.ts`, whose golden round-trip still passes because no override means all three default to `meta.analyzedAt`).
- [ ] **Step 5: Typecheck** → clean.
- [ ] **Step 6: Commit**

```bash
git add packages/pipeline/src/assemble.ts packages/pipeline/src/__tests__/assemble-incremental.test.ts
git commit -m "feat(pipeline): optional per-stream updatedAt override in assemble"
```

---

## Task 6: `--prior` / `--stale` in the `grasp-assemble` CLI

**Files:**
- Modify: `packages/pipeline/src/cli-run.ts`
- Test: `packages/pipeline/src/__tests__/cli-incremental.test.ts`

For an incremental run the orchestrator passes `--prior <priorBriefPath>` and `--stale <comma-list>`. Streams **not** listed keep their prior `updatedAt`; listed (stale) streams get `meta.analyzedAt`. When `--prior` is absent (first/full run) every stream uses `meta.analyzedAt`.

- [ ] **Step 1: Write the failing test**

`packages/pipeline/src/__tests__/cli-incremental.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "../cli-run";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(here, "fixtures");
const ANALYZED_AT = "2026-06-08T12:00:00Z";
const OLD = "2026-01-01T00:00:00Z";

let work: string;
let fragmentsDir: string;
let distDir: string;
let targetDir: string;
let priorBrief: string;

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), "grasp-cliinc-"));
  fragmentsDir = join(work, "fragments");
  distDir = join(work, "dist");
  targetDir = join(work, "repo");
  priorBrief = join(work, "prior.json");
  cpSync(fixturesDir, fragmentsDir, { recursive: true });
  mkdirSync(distDir, { recursive: true });
  writeFileSync(join(distDir, "index.html"), "<!doctype html>");
  mkdirSync(targetDir, { recursive: true });
  // A prior brief whose three streams were all last updated at OLD.
  writeFileSync(
    priorBrief,
    JSON.stringify({ brief: { updatedAt: { essence: OLD, success: OLD, landscape: OLD } } }),
  );
});
afterEach(() => {
  rmSync(work, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function brief() {
  return JSON.parse(readFileSync(join(targetDir, ".grasp", "dashboard", "repo-brief.json"), "utf8"));
}

describe("grasp-assemble incremental flags", () => {
  it("preserves fresh streams' prior updatedAt and bumps only the stale one", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const code = runCli([
      fragmentsDir,
      "--target", targetDir,
      "--dist", distDir,
      "--prior", priorBrief,
      "--stale", "essence",
    ]);
    expect(code).toBe(0);
    expect(brief().brief.updatedAt).toEqual({
      essence: ANALYZED_AT, // stale → now
      success: OLD,         // fresh → preserved
      landscape: OLD,       // fresh → preserved
    });
  });

  it("without --prior, every stream uses meta.analyzedAt (full run)", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    runCli([fragmentsDir, "--target", targetDir, "--dist", distDir]);
    expect(brief().brief.updatedAt).toEqual({
      essence: ANALYZED_AT,
      success: ANALYZED_AT,
      landscape: ANALYZED_AT,
    });
  });

  it("tolerates an unreadable --prior by falling back to a full run", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const code = runCli([
      fragmentsDir,
      "--target", targetDir,
      "--dist", distDir,
      "--prior", join(work, "missing.json"),
      "--stale", "essence",
    ]);
    expect(code).toBe(0);
    expect(brief().brief.updatedAt.success).toBe(ANALYZED_AT);
  });
});
```

- [ ] **Step 2: Run to verify it fails** (the first test fails — `--prior`/`--stale` are ignored, so all three are `ANALYZED_AT`): `npm test --workspace @grasp/pipeline`

- [ ] **Step 3: Implement the flags.** In `packages/pipeline/src/cli-run.ts`:

Add `readFileSync` is already imported. Extend the `Args` interface:

```ts
interface Args {
  fragmentsDir?: string;
  target?: string;
  dist?: string;
  prior?: string;
  stale?: string;
}
```

In `parseArgs`, add two cases inside the loop (alongside `--target` / `--dist`):

```ts
    else if (a === "--prior") args.prior = argv[++i];
    else if (a === "--stale") args.stale = argv[++i];
```

Add this helper above `runCli`:

```ts
type Stream = "essence" | "success" | "landscape";
const STREAMS: Stream[] = ["essence", "success", "landscape"];

/** From a prior brief + the stale set, build the per-stream updatedAt override (fresh streams keep prior timestamps). */
function resolveUpdatedAt(
  priorPath: string | undefined,
  staleList: string | undefined,
): { essence?: string; success?: string; landscape?: string } | undefined {
  if (!priorPath) return undefined;
  let prior: { brief?: { updatedAt?: Record<string, unknown> } };
  try {
    prior = JSON.parse(readFileSync(priorPath, "utf8"));
  } catch {
    return undefined; // unreadable prior → full run (no preservation)
  }
  const stale = new Set((staleList ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  const priorUpdated = prior.brief?.updatedAt ?? {};
  const override: { essence?: string; success?: string; landscape?: string } = {};
  for (const s of STREAMS) {
    const value = priorUpdated[s];
    if (!stale.has(s) && typeof value === "string") override[s] = value;
  }
  return override;
}
```

In `runCli`, destructure the new flags and pass the override into `assemble`. Change:

```ts
  const { fragmentsDir, target, dist } = parseArgs(argv);
```
to:
```ts
  const { fragmentsDir, target, dist, prior, stale } = parseArgs(argv);
```

and change the assemble call:

```ts
  const result = assemble({ meta, essence, success, landscape });
```
to:
```ts
  const result = assemble({
    meta,
    essence,
    success,
    landscape,
    updatedAt: resolveUpdatedAt(prior, stale),
  });
```

- [ ] **Step 4: Run the tests** → PASS (new file + the unchanged Plan-3 `cli.test.ts`, which never passes `--prior`, so its behavior is unchanged).
- [ ] **Step 5: Typecheck** → clean.
- [ ] **Step 6: Commit**

```bash
git add packages/pipeline/src/cli-run.ts packages/pipeline/src/__tests__/cli-incremental.test.ts
git commit -m "feat(pipeline): grasp-assemble --prior/--stale preserve fresh streams' freshness"
```

---

## Task 7: `--auto-update` git-hook installer

**Files:**
- Create: `packages/pipeline/src/autoupdate.ts`
- Create: `packages/pipeline/src/autoupdate-cli.ts`
- Modify: `packages/pipeline/package.json` (add bin)
- Test: `packages/pipeline/src/__tests__/autoupdate.test.ts`

`installAutoUpdate` writes `.grasp/config.json {autoUpdate:true}` and a `post-commit` hook (chmod 0o755) that runs `grasp-state --dry-run` and reminds the user to run `/grasp`. `removeAutoUpdate` deletes both. The hook does NOT regenerate the brief or write `state.json` (decision #4) — it only flags staleness.

- [ ] **Step 1: Write the failing test**

`packages/pipeline/src/__tests__/autoupdate.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installAutoUpdate, removeAutoUpdate } from "../autoupdate";

let dir: string;
const hookPath = (d: string) => join(d, ".git", "hooks", "post-commit");
const configPath = (d: string) => join(d, ".grasp", "config.json");

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "grasp-au-"));
  mkdirSync(join(dir, ".git", "hooks"), { recursive: true }); // pretend it's a git repo
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("auto-update install/remove", () => {
  it("installs a config and an executable post-commit hook", () => {
    installAutoUpdate(dir);
    expect(JSON.parse(readFileSync(configPath(dir), "utf8"))).toEqual({ autoUpdate: true });
    expect(existsSync(hookPath(dir))).toBe(true);
    const hook = readFileSync(hookPath(dir), "utf8");
    expect(hook).toContain("grasp-state");
    expect(hook).toContain("--dry-run");
    // executable bit set for the owner
    expect(statSync(hookPath(dir)).mode & 0o100).toBe(0o100);
  });

  it("throws when the directory is not a git repo", () => {
    const notGit = mkdtempSync(join(tmpdir(), "grasp-nogit-"));
    expect(() => installAutoUpdate(notGit)).toThrow(/not a git repo/);
    rmSync(notGit, { recursive: true, force: true });
  });

  it("removes the hook and the config flag", () => {
    installAutoUpdate(dir);
    removeAutoUpdate(dir);
    expect(existsSync(hookPath(dir))).toBe(false);
    expect(JSON.parse(readFileSync(configPath(dir), "utf8"))).toEqual({ autoUpdate: false });
  });

  it("remove is a no-op when nothing was installed", () => {
    expect(() => removeAutoUpdate(dir)).not.toThrow();
    expect(existsSync(hookPath(dir))).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails** ("Cannot find module '../autoupdate'"): `npm test --workspace @grasp/pipeline`

- [ ] **Step 3: Implement `autoupdate.ts`**

`packages/pipeline/src/autoupdate.ts`:

```ts
import { existsSync, mkdirSync, writeFileSync, rmSync, chmodSync } from "node:fs";
import { join } from "node:path";

const HOOK = `#!/bin/sh
# Installed by grasp --auto-update. Flags which strategic-brief streams a commit
# made stale; it does not regenerate the brief (that needs the LLM agents — run /grasp).
grasp-state --target "$(git rev-parse --show-toplevel)" \\
  --sources "$(git rev-parse --show-toplevel)/.grasp/sources.json" --dry-run 2>/dev/null \\
  && echo "grasp: brief may be stale — run /grasp to refresh."
`;

function gitHooksDir(targetDir: string): string {
  return join(targetDir, ".git", "hooks");
}

function configPath(targetDir: string): string {
  return join(targetDir, ".grasp", "config.json");
}

function writeConfig(targetDir: string, autoUpdate: boolean): void {
  mkdirSync(join(targetDir, ".grasp"), { recursive: true });
  writeFileSync(configPath(targetDir), `${JSON.stringify({ autoUpdate }, null, 2)}\n`, "utf8");
}

export function installAutoUpdate(targetDir: string): void {
  const hooks = gitHooksDir(targetDir);
  if (!existsSync(hooks)) {
    throw new Error(`${targetDir} is not a git repo (no .git/hooks) — cannot install the post-commit hook`);
  }
  const hookPath = join(hooks, "post-commit");
  writeFileSync(hookPath, HOOK, "utf8");
  chmodSync(hookPath, 0o755);
  writeConfig(targetDir, true);
}

export function removeAutoUpdate(targetDir: string): void {
  const hookPath = join(gitHooksDir(targetDir), "post-commit");
  if (existsSync(hookPath)) rmSync(hookPath);
  writeConfig(targetDir, false);
}
```

- [ ] **Step 4: Implement the bin wrapper** at `packages/pipeline/src/autoupdate-cli.ts`:

```ts
#!/usr/bin/env tsx
import { installAutoUpdate, removeAutoUpdate } from "./autoupdate";

function main(argv: string[]): number {
  const off = argv.includes("--off");
  const target = (() => {
    const i = argv.indexOf("--target");
    return i >= 0 ? argv[i + 1] : process.cwd();
  })();
  try {
    if (off) removeAutoUpdate(target);
    else installAutoUpdate(target);
    console.log(off ? "grasp: auto-update disabled" : "grasp: auto-update enabled (post-commit hook installed)");
    return 0;
  } catch (err) {
    console.error((err as Error).message);
    return 2;
  }
}

process.exit(main(process.argv.slice(2)));
```

- [ ] **Step 5: Register the bin.** In `packages/pipeline/package.json`, extend `bin`:

```json
  "bin": {
    "grasp-assemble": "src/cli.ts",
    "grasp-state": "src/state-cli.ts",
    "grasp-autoupdate": "src/autoupdate-cli.ts"
  },
```

- [ ] **Step 6: Run the tests** → PASS.
- [ ] **Step 7: Typecheck** → clean.
- [ ] **Step 8: Commit**

```bash
git add packages/pipeline/src/autoupdate.ts packages/pipeline/src/autoupdate-cli.ts packages/pipeline/package.json packages/pipeline/src/__tests__/autoupdate.test.ts
git commit -m "feat(pipeline): --auto-update post-commit hook that flags stale streams"
```

---

## Task 8: wire incremental into `SKILL.md`

**Files:**
- Modify: `skills/grasp/SKILL.md`
- Modify: `packages/pipeline/src/__tests__/skill-contract.test.ts`

- [ ] **Step 1: Extend the drift-guard test.** In `packages/pipeline/src/__tests__/skill-contract.test.ts`, replace the token list in the "references the real moving parts" test with:

```ts
    for (const token of [
      "grasp-assemble",
      "grasp-state",
      "essence-analyzer",
      "success-analyzer",
      "landscape-analyzer",
      "depth",
      "broadness",
      ".grasp",
      "Phase 0.5",
      "state.json",
      "--full",
      "--auto-update",
      "--prior",
    ]) {
      expect(md).toContain(token);
    }
```

- [ ] **Step 2: Run to verify it fails** (current SKILL.md lacks `grasp-state`, `Phase 0.5`, etc.): `npm test --workspace @grasp/pipeline`

- [ ] **Step 3: Update `skills/grasp/SKILL.md`.** Make these edits:

(a) Insert a new **Phase 0.5** section immediately after the Phase 0 section and before "## Phase 1":

````markdown
## Phase 0.5 — Staleness check (incremental re-runs)

If `<target>/.grasp/` already exists from a prior run, decide what to recompute
instead of redoing everything. After gathering sources (Phase 1) write a
`<target>/.grasp/sources.json` — `{ "docs": [...], "code": [...], "signals": {...},
"broadness": "web" }` (paths relative to the target) — then run:

```bash
npx tsx packages/pipeline/src/state-cli.ts --target <target> \
  --sources <target>/.grasp/sources.json
```

It prints a JSON verdict like `{"essence":true,"success":false,"landscape":false,"firstRun":false}`
and refreshes `.grasp/state.json`. In Phase 2 dispatch **only** the stale streams'
agents; reuse the existing fragment files for the rest.

- `--full` — ignore fingerprints, recompute everything.
- `--refresh-landscape` — force the (market-stable) landscape to refresh.
- A missing/corrupt `state.json` is treated as a first run (everything stale).
````

(b) In **Phase 2**, change the dispatch instruction so it is conditioned on staleness. Replace the bullet list intro line "Dispatch in parallel where independent." with:

```markdown
Dispatch in parallel where independent — but **only the streams Phase 0.5 marked
stale** (on a first run, all of them). A fresh stream keeps its existing
`.grasp/fragments/*.json` untouched.
```

(c) In **Phase 3**, change the assemble command to pass incremental flags on a re-run. Replace the existing fenced `npx tsx packages/pipeline/src/cli.ts ...` command block with:

````markdown
```bash
npx tsx packages/pipeline/src/cli.ts <target>/.grasp/fragments \
  --target <target> --dist packages/dashboard/dist \
  --prior <target>/.grasp/dashboard/repo-brief.json \
  --stale <comma-separated stale streams from Phase 0.5>
```

On a first run (no prior brief) omit `--prior`/`--stale`. `--prior` preserves the
`brief.updatedAt` of streams that did **not** re-run; the stale ones get the new
`meta.analyzedAt`.
````

(d) Add an **Incremental flags** subsection at the end (after "## Degradation & errors"):

```markdown
## Incremental flags

- `--full` — recompute every stream regardless of fingerprints.
- `--refresh-landscape` — refresh the competitive landscape (otherwise market-stable).
- `--auto-update` — install a `post-commit` git hook that flags stale streams after
  each commit (it reminds you to run `/grasp`; it does not regenerate autonomously):
  `npx tsx packages/pipeline/src/autoupdate-cli.ts --target <target>`. Disable with
  the same command plus `--off`.
```

- [ ] **Step 4: Run the tests** → PASS (the drift-guard now finds every token).
- [ ] **Step 5: Commit**

```bash
git add skills/grasp/SKILL.md packages/pipeline/src/__tests__/skill-contract.test.ts
git commit -m "feat(skill): wire Phase 0.5 staleness + incremental flags into the orchestrator"
```

---

## Final verification (after all tasks)

- [ ] Run the whole pipeline suite: `npm test --workspace @grasp/pipeline`
  Expected: all prior Plan-3 tests (28) plus the new ones pass.
- [ ] Run every workspace: `npm test --workspaces --if-present`
  Expected: schema, dashboard, and pipeline suites all PASS.
- [ ] Typecheck every workspace: `npm run typecheck --workspace @grasp/schema && npm run typecheck --workspace @grasp/dashboard && npm run typecheck --workspace @grasp/pipeline`
  Expected: no errors.
- [ ] Manual incremental smoke (deterministic half): in a temp dir create `sources.json` + a `docs`/`code` file, run `grasp-state` twice (second run reports nothing stale), edit a doc file, run again (only `essence` stale). Confirm `.grasp/state.json` updates and `--dry-run` leaves it unchanged.
- [ ] `git status` clean (no stray `.grasp/`, temp dirs, or exec-bit noise committed).

## Scope note

This completes the design's full v1 scope (spec §10 steps 1–6). The post-commit hook flags staleness rather than autonomously regenerating (decision #4) because a git hook cannot drive the LLM analyzer agents; full regeneration remains a user-invoked `/grasp`.
