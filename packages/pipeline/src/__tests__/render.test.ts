import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateBrief } from "@grasp/schema";
import goldenSample from "@grasp/schema/sample-brief.json";
import { render } from "../render";

const doc = validateBrief(goldenSample).data!;

let work: string;
let distDir: string;
let targetDir: string;

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), "grasp-render-"));
  distDir = join(work, "dist");
  targetDir = join(work, "repo");
  // Fake a vendored dashboard build.
  mkdirSync(join(distDir, "assets"), { recursive: true });
  writeFileSync(join(distDir, "index.html"), "<!doctype html><div id=root></div>");
  writeFileSync(join(distDir, "assets", "app.js"), "console.log('app')");
  mkdirSync(targetDir, { recursive: true });
});

afterEach(() => {
  rmSync(work, { recursive: true, force: true });
});

describe("render", () => {
  it("copies the dist and writes a valid brief beside index.html", () => {
    const out = render({ doc, targetDir, distDir });

    expect(out.outputDir).toBe(join(targetDir, ".grasp", "dashboard"));
    expect(existsSync(out.indexPath)).toBe(true);
    expect(existsSync(join(out.outputDir, "assets", "app.js"))).toBe(true);
    expect(existsSync(out.briefPath)).toBe(true);

    const written = JSON.parse(readFileSync(out.briefPath, "utf8"));
    expect(validateBrief(written).ok).toBe(true);
    expect(written).toEqual(doc);
  });

  it("throws a clear error when the dist is missing", () => {
    expect(() => render({ doc, targetDir, distDir: join(work, "nope") })).toThrow(
      /dist not found/,
    );
  });
});
