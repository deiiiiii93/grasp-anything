import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "../cli-run";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(here, "fixtures");
const ANALYZED_AT = "2026-06-10T12:00:00Z";
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
