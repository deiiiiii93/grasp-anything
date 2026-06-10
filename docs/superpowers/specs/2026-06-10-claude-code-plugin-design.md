# Grasp — Claude Code Plugin Distribution Design

**Date:** 2026-06-10
**Distribution target:** `github:deiiiiii93/grasp-anything`
**Install command:** `claude plugin install github:deiiiiii93/grasp-anything`

---

## Goal

Make this project installable as a Claude Code plugin so any user can run `/grasp` on any repository without cloning this repo.

---

## Repository layout changes

Four additions; nothing moved or deleted:

```
.claude-plugin/
  plugin.json          ← NEW: plugin manifest
skills/
  grasp/
    SKILL.md           ← MODIFIED: path fixes + dist gate
    setup/
      SKILL.md         ← NEW: /grasp:setup skill
agents/                ← unchanged
packages/              ← unchanged (source ships as-is; tsx runs it directly)
```

No `hooks/` needed — auto-build is explicit via `/grasp:setup`, not a session hook.

---

## `.claude-plugin/plugin.json`

```json
{
  "name": "grasp",
  "displayName": "Grasp",
  "description": "Turn any repository into a strategic brief: five answers (idea, problem, why it wins, how, similar repos) backed by two interactive graphs.",
  "version": "0.1.0",
  "author": {
    "name": "deiiiiii93",
    "url": "https://github.com/deiiiiii93"
  },
  "homepage": "https://github.com/deiiiiii93/grasp-anything",
  "repository": "https://github.com/deiiiiii93/grasp-anything",
  "license": "MIT",
  "keywords": [
    "repository-analysis",
    "strategic-brief",
    "atlas",
    "competitive-landscape",
    "visualization"
  ]
}
```

Skills and agents are auto-discovered from `skills/` and `agents/` directories — no explicit listing required.

---

## `/grasp:setup` skill (`skills/grasp/setup/SKILL.md`)

**Trigger:** user types `/grasp:setup`, or is directed here by the `/grasp` dist gate.

**Steps:**
1. Print: `Installing Grasp dependencies…`
2. Run `cd "$CLAUDE_PLUGIN_ROOT" && npm install`
3. Run `npm run build --workspace packages/dashboard` (builds React dashboard to `packages/dashboard/dist/`)
4. Verify `$CLAUDE_PLUGIN_ROOT/packages/dashboard/dist/index.html` exists
5. On success: print `Grasp is ready. Run /grasp on any repository.`
6. On failure: surface the npm/vite error verbatim so the user can diagnose

**Re-runnable:** works after `git pull` to rebuild with updated dashboard assets. No state to clean first.

**Prerequisites:** Node ≥ 22 (matches repo `engines` field).

---

## Path fixes in `skills/grasp/SKILL.md`

All relative package paths become `$CLAUDE_PLUGIN_ROOT`-anchored:

| Before | After |
|--------|-------|
| `npx tsx packages/pipeline/src/cli.ts` | `npx tsx "$CLAUDE_PLUGIN_ROOT/packages/pipeline/src/cli.ts"` |
| `npx tsx packages/pipeline/src/state-cli.ts` | `npx tsx "$CLAUDE_PLUGIN_ROOT/packages/pipeline/src/state-cli.ts"` |
| `--dist packages/dashboard/dist` | `--dist "$CLAUDE_PLUGIN_ROOT/packages/dashboard/dist"` |

### Phase 0 dist gate (added at top of Phase 0)

Before the wizard runs, check:

```
if [ ! -f "$CLAUDE_PLUGIN_ROOT/packages/dashboard/dist/index.html" ]; then
  tell user: "Grasp needs a one-time build step. Run /grasp:setup first, then try again."
  stop
fi
```

This gate fires only on first install (or after `rm -rf dist`). Normal runs are unaffected.

---

## Error handling

| Scenario | Behaviour |
|----------|-----------|
| `npm install` fails in setup | Surface error verbatim; suggest checking Node version ≥ 22 |
| `npm run build` fails | Surface vite error; dist gate will re-trigger on next `/grasp` run |
| `dist/` exists but is corrupt | Phase 3 assembler exits 1; normal repair loop handles it |
| User runs `/grasp` before setup | Dist gate catches it, directs to `/grasp:setup` |

---

## Distribution

Users install with:
```
claude plugin install github:deiiiiii93/grasp-anything
```

After install, first-time setup:
```
/grasp:setup    ← one-time, ~30s
/grasp          ← works on any directory or GitHub URL from now on
```

No npm publish required. No GitHub releases or build artifacts needed in the repo.

---

## What does NOT change

- `packages/` source code — untouched
- `agents/` definitions — untouched  
- `skills/grasp/SKILL.md` logic — only path strings change + the dist gate addition
- Test suite — all 44 tests remain green (path changes don't affect test execution since tests use local paths)
