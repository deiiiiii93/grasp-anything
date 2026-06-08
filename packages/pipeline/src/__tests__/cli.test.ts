import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  cpSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateBrief } from "@grasp/schema";
import { runCli } from "../cli-run";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(here, "fixtures");

let work: string;
let fragmentsDir: string;
let distDir: string;
let targetDir: string;

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), "grasp-cli-"));
  fragmentsDir = join(work, "fragments");
  distDir = join(work, "dist");
  targetDir = join(work, "repo");
  // Copy golden fragments into a working fragments dir.
  cpSync(fixturesDir, fragmentsDir, { recursive: true });
  // Fake a vendored dashboard build.
  mkdirSync(distDir, { recursive: true });
  writeFileSync(join(distDir, "index.html"), "<!doctype html>");
  mkdirSync(targetDir, { recursive: true });
});

afterEach(() => {
  rmSync(work, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("runCli", () => {
  it("exits 0 and renders a valid brief for good fragments", () => {
    const code = runCli([fragmentsDir, "--target", targetDir, "--dist", distDir]);
    expect(code).toBe(0);
    const briefPath = join(targetDir, ".grasp", "dashboard", "repo-brief.json");
    expect(existsSync(briefPath)).toBe(true);
    expect(validateBrief(JSON.parse(readFileSync(briefPath, "utf8"))).ok).toBe(true);
  });

  it("works offline when landscape.json is absent", () => {
    rmSync(join(fragmentsDir, "landscape.json"));
    const code = runCli([fragmentsDir, "--target", targetDir, "--dist", distDir]);
    expect(code).toBe(0);
    const brief = JSON.parse(
      readFileSync(join(targetDir, ".grasp", "dashboard", "repo-brief.json"), "utf8"),
    );
    expect(brief.landscapeGraph.nodes).toHaveLength(1);
  });

  it("exits 2 on missing required flags", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(runCli([fragmentsDir, "--target", targetDir])).toBe(2);
  });

  it("exits 1 when a fragment is invalid", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    writeFileSync(join(fragmentsDir, "success.json"), JSON.stringify({ why: "", takeaway: "" }));
    expect(runCli([fragmentsDir, "--target", targetDir, "--dist", distDir])).toBe(1);
  });
});
