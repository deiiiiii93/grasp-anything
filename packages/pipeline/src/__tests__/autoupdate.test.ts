import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, existsSync, statSync, rmSync } from "node:fs";
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
