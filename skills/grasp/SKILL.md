---
name: grasp
description: Use when the user wants to understand a repository strategically (not technically) — its main idea, the problem it solves, why it succeeds, how it works, and similar projects. Produces an interactive HTML brief with two graphs from a local path or public GitHub URL.
---

# `/grasp` — Strategic Repo Understanding

Turn any repository into a **strategic brief**: five answers (idea, problem, why
it wins, how, similar repos) backed by two interactive graphs (product atlas +
competitive landscape). You orchestrate three analyzer agents, assemble their
output into a validated `repo-brief.json`, and render the vendored dashboard.

**Architecture you are driving:** the agents produce judgment; the deterministic
`grasp-assemble` CLI validates and renders; `grasp-state` tracks fingerprints and
decides which streams are stale; `repo-brief.json` is the only contract between
them. Never hand-edit the brief — fix the agent that produced the bad fragment
and re-assemble.

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

## Phase 1 — Gather sources (conditioned on depth × broadness)

- Always: README, `docs/`, manifests, file tree, git signals (stars where
  available, last commit, language).
- `skim`/`deep`: read entry points and core files.
- `web`: fetch GitHub stars/issues and search for "alternatives to X".

Record the gathered signals so you can build `meta` (repo, url, depth, broadness,
`analyzedAt` as an ISO timestamp, signals).

## Phase 2 — Dispatch the analyzer agents

Dispatch in parallel where independent — but **only the streams Phase 0.5 marked
stale** (on a first run, all of them). A fresh stream keeps its existing
`.grasp/fragments/*.json` untouched. Each agent returns **only** a JSON
fragment; write each to `<target>/.grasp/fragments/`:

- **essence-analyzer** → `essence.json` (**atlas** continents/cities/landmarks + idea/problem/how)
- **success-analyzer** → `success.json` (why + takeaway + evidence)
- **landscape-analyzer** → `landscape.json` (landscape graph) — **skip when
  `broadness: offline`**; the assembler then synthesizes a self-only landscape.

Also write `meta.json` (from Phase 1) into the same `fragments/` dir.

## Phase 3 — Assemble + validate (with one repair pass)

Run the deterministic CLI:

```bash
npx tsx packages/pipeline/src/cli.ts <target>/.grasp/fragments \
  --target <target> --dist packages/dashboard/dist \
  --prior <target>/.grasp/dashboard/repo-brief.json \
  --stale <comma-separated stale streams from Phase 0.5>
```

On a first run (no prior brief) omit `--prior`/`--stale`. `--prior` preserves the
`brief.updatedAt` of streams that did **not** re-run; the stale ones get the new
`meta.analyzedAt`.

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

## Degradation & errors

- `broadness: web` but search is unavailable → degrade to offline; tell the user
  the landscape is inferred, not verified.
- GitHub clone fails → fall back to README/metadata; if that also fails, stop and
  explain.
- Huge repo at `deep` → cap the files analyzed and note the cap.

## Incremental flags

- `--full` — recompute every stream regardless of fingerprints.
- `--refresh-landscape` — refresh the competitive landscape (otherwise market-stable).
- `--auto-update` — install a `post-commit` git hook that flags stale streams after
  each commit (it reminds you to run `/grasp`; it does not regenerate autonomously):
  `npx tsx packages/pipeline/src/autoupdate-cli.ts --target <target>`. Disable with
  the same command plus `--off`.
