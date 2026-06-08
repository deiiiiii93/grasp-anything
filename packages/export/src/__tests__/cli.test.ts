import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sample from "@grasp/schema/sample-brief.json";
import { runExport } from "../cli-run";

let work: string;
let briefPath: string;
let outDir: string;

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), "grasp-export-"));
  briefPath = join(work, "repo-brief.json");
  outDir = join(work, "out");
  writeFileSync(briefPath, JSON.stringify(sample));
  mkdirSync(outDir, { recursive: true });
});
afterEach(() => {
  rmSync(work, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("runExport", () => {
  it("writes both report.md and report.html by default", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const code = runExport([briefPath, "--out", outDir]);
    expect(code).toBe(0);
    expect(readFileSync(join(outDir, "report.md"), "utf8").length).toBeGreaterThan(0);
    expect(readFileSync(join(outDir, "report.html"), "utf8")).toContain("<svg ");
  });

  it("--format md writes only the markdown", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const code = runExport([briefPath, "--out", outDir, "--format", "md"]);
    expect(code).toBe(0);
    expect(existsSync(join(outDir, "report.md"))).toBe(true);
    expect(existsSync(join(outDir, "report.html"))).toBe(false);
  });

  it("exits 1 on an invalid brief", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const bad = join(work, "bad.json");
    writeFileSync(bad, JSON.stringify({ meta: {} }));
    expect(runExport([bad, "--out", outDir])).toBe(1);
  });

  it("exits 2 on missing brief argument", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(runExport(["--out", outDir])).toBe(2);
  });

  it("exits 2 on an unknown --format", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(runExport([briefPath, "--out", outDir, "--format", "pdf"])).toBe(2);
  });
});
