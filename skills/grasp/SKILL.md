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
