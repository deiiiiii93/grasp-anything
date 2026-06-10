# Grasp Claude Code Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the three files that turn this monorepo into a `claude plugin install github:deiiiiii93/grasp-anything`-installable Claude Code plugin.

**Architecture:** A `.claude-plugin/plugin.json` manifest makes the repo discoverable. A new `/grasp:setup` skill handles the one-time `npm install` + dashboard build. The existing `/grasp` skill gets a dist gate at the top of Phase 0 and has all relative `packages/` paths replaced with `$CLAUDE_PLUGIN_ROOT`-anchored absolute paths. One extra subtlety: `npx tsx` resolves tsx from the caller's CWD (which is the user's project, not the plugin root); every tsx invocation is changed to `"$CLAUDE_PLUGIN_ROOT/node_modules/.bin/tsx"` so it always hits the plugin's own install.

**Tech Stack:** Claude Code plugin manifest (JSON), Markdown skill files, npm workspaces, Node ≥ 22, Vite (dashboard build).

---

## File map

| Action | Path | Purpose |
|--------|------|---------|
| CREATE | `.claude-plugin/plugin.json` | Plugin manifest — name, version, author, keywords |
| CREATE | `skills/grasp/setup/SKILL.md` | `/grasp:setup` — `npm install` + dashboard build |
| MODIFY | `skills/grasp/SKILL.md` | Dist gate in Phase 0 + 5 path fixes |

---

## Task 1: Create `.claude-plugin/plugin.json`

**Files:**
- Create: `.claude-plugin/plugin.json`

- [ ] **Step 1: Create the directory and write the manifest**

```bash
mkdir -p .claude-plugin
```

Then create `.claude-plugin/plugin.json` with this exact content:

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

- [ ] **Step 2: Verify JSON parses cleanly**

```bash
node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json','utf8')); console.log('valid')"
```

Expected output: `valid`

- [ ] **Step 3: Commit**

```bash
git add .claude-plugin/plugin.json
git commit -m "feat(plugin): add Claude Code plugin manifest"
```

---

## Task 2: Create `/grasp:setup` skill

**Files:**
- Create: `skills/grasp/setup/SKILL.md`

- [ ] **Step 1: Create the directory and write the skill**

```bash
mkdir -p skills/grasp/setup
```

Then create `skills/grasp/setup/SKILL.md` with this exact content:

```markdown
---
name: grasp:setup
description: Use when the user runs /grasp:setup or is directed here by /grasp because the dashboard has not been built yet. Installs npm dependencies and builds the Grasp dashboard. Re-runnable after git pull.
---

# `/grasp:setup` — One-time Grasp installation

Run this once after installing the Grasp plugin, and again after any `git pull`
that updates the dashboard.

## Steps

1. Tell the user: "Installing Grasp dependencies — this takes about 30 seconds…"

2. Run:

```bash
cd "$CLAUDE_PLUGIN_ROOT" && npm install
```

   - If this fails, surface the full error output and tell the user: "npm install
     failed. Check that Node ≥ 22 is installed (`node --version`) and try again."
   - Stop on failure — do not proceed to the build step.

3. Run:

```bash
cd "$CLAUDE_PLUGIN_ROOT" && npm run build -w @grasp/dashboard
```

   - If this fails, surface the full error output and tell the user: "Dashboard
     build failed. The error above is from Vite. Fix the issue and re-run
     `/grasp:setup`."
   - Stop on failure.

4. Verify the build produced output:

```bash
test -f "$CLAUDE_PLUGIN_ROOT/packages/dashboard/dist/index.html" && echo "ok" || echo "missing"
```

   Expected: `ok`

   If `missing`: tell the user "Build appeared to succeed but dist/index.html is
   absent — try running `/grasp:setup` again."

5. Tell the user: "Grasp is ready. Run `/grasp` on any local path or GitHub URL."
```

- [ ] **Step 2: Verify the file exists and has correct frontmatter**

```bash
head -5 skills/grasp/setup/SKILL.md
```

Expected:
```
---
name: grasp:setup
description: Use when the user runs /grasp:setup or is directed here by /grasp because the dashboard has not been built yet. Installs npm dependencies and builds the Grasp dashboard. Re-runnable after git pull.
---
```

- [ ] **Step 3: Commit**

```bash
git add skills/grasp/setup/SKILL.md
git commit -m "feat(plugin): add /grasp:setup skill for one-time dashboard build"
```

---

## Task 3: Update `skills/grasp/SKILL.md` — dist gate + path fixes

**Files:**
- Modify: `skills/grasp/SKILL.md`

There are 5 path occurrences to fix and 1 gate to add. Make them all in this task — do not commit partially.

### The 5 path substitutions

| # | Find (exact string) | Replace with |
|---|---------------------|--------------|
| 1 | `npx tsx packages/pipeline/src/state-cli.ts` | `"$CLAUDE_PLUGIN_ROOT/node_modules/.bin/tsx" "$CLAUDE_PLUGIN_ROOT/packages/pipeline/src/state-cli.ts"` |
| 2 | `npx tsx packages/pipeline/src/cli.ts` | `"$CLAUDE_PLUGIN_ROOT/node_modules/.bin/tsx" "$CLAUDE_PLUGIN_ROOT/packages/pipeline/src/cli.ts"` |
| 3 | `--dist packages/dashboard/dist` | `--dist "$CLAUDE_PLUGIN_ROOT/packages/dashboard/dist"` |
| 4 | `npx tsx packages/export/src/cli.ts` | `"$CLAUDE_PLUGIN_ROOT/node_modules/.bin/tsx" "$CLAUDE_PLUGIN_ROOT/packages/export/src/cli.ts"` |
| 5 | `npx tsx packages/pipeline/src/autoupdate-cli.ts` | `"$CLAUDE_PLUGIN_ROOT/node_modules/.bin/tsx" "$CLAUDE_PLUGIN_ROOT/packages/pipeline/src/autoupdate-cli.ts"` |

There is also one inline hint in the Exit 2 description (line ~105). Find:

```
build it with `npm run build --workspace
     @grasp/dashboard`
```

Replace with:

```
build it with `cd "$CLAUDE_PLUGIN_ROOT" && npm run build -w @grasp/dashboard`
```

### The dist gate

At the **top of the "Phase 0 — Resolve target + run the wizard" section**, before step 1, insert this new step 0:

```markdown
0. **Dist gate** — check that the dashboard has been built:

```bash
test -f "$CLAUDE_PLUGIN_ROOT/packages/dashboard/dist/index.html" && echo "ok" || echo "missing"
```

   If `missing`: tell the user "Grasp needs a one-time build step. Run
   `/grasp:setup` first, then try `/grasp` again." and **stop** — do not proceed.
```

- [ ] **Step 1: Apply substitution 1 (state-cli.ts)**

In `skills/grasp/SKILL.md`, find:

```
npx tsx packages/pipeline/src/state-cli.ts --target <target> \
  --sources <target>/.grasp/sources.json
```

Replace with:

```
"$CLAUDE_PLUGIN_ROOT/node_modules/.bin/tsx" "$CLAUDE_PLUGIN_ROOT/packages/pipeline/src/state-cli.ts" --target <target> \
  --sources <target>/.grasp/sources.json
```

- [ ] **Step 2: Apply substitution 2 + 3 (cli.ts + --dist)**

Find:

```
npx tsx packages/pipeline/src/cli.ts <target>/.grasp/fragments \
  --target <target> --dist packages/dashboard/dist \
```

Replace with:

```
"$CLAUDE_PLUGIN_ROOT/node_modules/.bin/tsx" "$CLAUDE_PLUGIN_ROOT/packages/pipeline/src/cli.ts" <target>/.grasp/fragments \
  --target <target> --dist "$CLAUDE_PLUGIN_ROOT/packages/dashboard/dist" \
```

- [ ] **Step 3: Apply inline hint fix (Exit 2)**

Find (in the Exit 2 bullet, around line 104):

```
  dashboard `dist` is missing — build it with `npm run build --workspace
  @grasp/dashboard`).
```

Replace with:

```
  dashboard `dist` is missing — build it with `cd "$CLAUDE_PLUGIN_ROOT" && npm run build -w @grasp/dashboard`).
```

- [ ] **Step 4: Apply substitution 4 (export cli)**

Find:

```
npx tsx packages/export/src/cli.ts <target>/.grasp/dashboard/repo-brief.json \
  --format both --out <target>/.grasp
```

Replace with:

```
"$CLAUDE_PLUGIN_ROOT/node_modules/.bin/tsx" "$CLAUDE_PLUGIN_ROOT/packages/export/src/cli.ts" <target>/.grasp/dashboard/repo-brief.json \
  --format both --out <target>/.grasp
```

- [ ] **Step 5: Apply substitution 5 (autoupdate-cli)**

Find:

```
  `npx tsx packages/pipeline/src/autoupdate-cli.ts --target <target>`. Disable with
```

Replace with:

```
  `"$CLAUDE_PLUGIN_ROOT/node_modules/.bin/tsx" "$CLAUDE_PLUGIN_ROOT/packages/pipeline/src/autoupdate-cli.ts" --target <target>`. Disable with
```

- [ ] **Step 6: Add the Phase 0 dist gate**

In `skills/grasp/SKILL.md`, find the beginning of Phase 0:

```
## Phase 0 — Resolve target + run the wizard

1. Determine the target
```

Replace with:

```
## Phase 0 — Resolve target + run the wizard

0. **Dist gate** — check that the dashboard has been built:

   ```bash
   test -f "$CLAUDE_PLUGIN_ROOT/packages/dashboard/dist/index.html" && echo "ok" || echo "missing"
   ```

   If `missing`: tell the user "Grasp needs a one-time build step. Run
   `/grasp:setup` first, then try `/grasp` again." and **stop** — do not proceed.

1. Determine the target
```

- [ ] **Step 7: Verify no bare `packages/` paths remain**

```bash
grep -n "npx tsx packages/" skills/grasp/SKILL.md || echo "clean"
grep -n '"--dist packages/' skills/grasp/SKILL.md || echo "clean"
```

Expected: both print `clean`

- [ ] **Step 8: Verify dist gate is present**

```bash
grep -n "Dist gate" skills/grasp/SKILL.md
```

Expected output includes a line with `Dist gate`

- [ ] **Step 9: Run the existing test suite to confirm no regressions**

```bash
npm test --workspaces --if-present 2>&1 | tail -20
```

Expected: all tests pass (44 tests green). The path changes in the skill file don't affect test execution since tests call the pipeline CLIs directly with local paths.

- [ ] **Step 10: Commit**

```bash
git add skills/grasp/SKILL.md
git commit -m "feat(plugin): fix skill paths to use CLAUDE_PLUGIN_ROOT + add dist gate"
```

---

## Task 4: Smoke-test the plugin locally

**Files:** none modified

- [ ] **Step 1: Verify the full plugin directory layout**

```bash
ls .claude-plugin/
ls skills/grasp/
ls skills/grasp/setup/
```

Expected:
```
.claude-plugin/: plugin.json
skills/grasp/: SKILL.md  setup/
skills/grasp/setup/: SKILL.md
```

- [ ] **Step 2: Confirm plugin.json is valid JSON with expected fields**

```bash
node -e "
const p = JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json','utf8'));
console.log('name:', p.name);
console.log('version:', p.version);
console.log('repository:', p.repository);
"
```

Expected:
```
name: grasp
version: 0.1.0
repository: https://github.com/deiiiiii93/grasp-anything
```

- [ ] **Step 3: Confirm no old-style paths remain in the skill**

```bash
grep -rn "npx tsx packages/" skills/ agents/ || echo "clean"
```

Expected: `clean`

- [ ] **Step 4: Final commit confirming all clean**

If steps 1–3 all pass with no changes needed, the three previous commits are the complete deliverable. Push to `deiiiiii93/grasp-anything`:

```bash
git log --oneline -4
```

Expected: four commits including the spec, plugin.json, setup skill, and path-fix commits.
