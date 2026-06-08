import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateBrief } from "@grasp/schema";
import goldenSample from "@grasp/schema/sample-brief.json";
import { runCli } from "../cli-run";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../../..");
const fixturesDir = resolve(here, "fixtures");

describe("plugin manifest", () => {
  const manifest = JSON.parse(readFileSync(resolve(repoRoot, ".claude-plugin/plugin.json"), "utf8"));

  it("is a valid manifest named grasp with a description", () => {
    expect(manifest.name).toBe("grasp");
    expect(typeof manifest.description).toBe("string");
    expect(manifest.description.length).toBeGreaterThan(0);
  });

  it("ships the skill and agents it advertises (by convention)", () => {
    for (const rel of [
      "skills/grasp/SKILL.md",
      "agents/essence-analyzer.md",
      "agents/success-analyzer.md",
      "agents/landscape-analyzer.md",
    ]) {
      expect(existsSync(resolve(repoRoot, rel))).toBe(true);
    }
  });
});

describe("end-to-end: golden fragments → brief → render", () => {
  let work: string;
  let distDir: string;
  let targetDir: string;

  beforeEach(() => {
    work = mkdtempSync(join(tmpdir(), "grasp-e2e-"));
    distDir = join(work, "dist");
    targetDir = join(work, "repo");
    mkdirSync(distDir, { recursive: true });
    writeFileSync(join(distDir, "index.html"), "<!doctype html>");
    mkdirSync(targetDir, { recursive: true });
  });

  afterEach(() => rmSync(work, { recursive: true, force: true }));

  it("reproduces the exact golden brief on disk", () => {
    const code = runCli([fixturesDir, "--target", targetDir, "--dist", distDir]);
    expect(code).toBe(0);
    const written = JSON.parse(
      readFileSync(join(targetDir, ".grasp", "dashboard", "repo-brief.json"), "utf8"),
    );
    expect(validateBrief(written).ok).toBe(true);
    expect(written).toEqual(goldenSample);
  });
});
