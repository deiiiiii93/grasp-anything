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
