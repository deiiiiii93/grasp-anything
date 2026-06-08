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
