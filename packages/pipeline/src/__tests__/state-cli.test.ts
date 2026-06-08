import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runState } from "../state-run";
import { statePath } from "../state";

let dir: string;
let sources: string;

function writeSources(obj: unknown) {
  writeFileSync(sources, JSON.stringify(obj), "utf8");
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "grasp-statecli-"));
  sources = join(dir, "sources.json");
  mkdirSync(join(dir, "docs"), { recursive: true });
  writeFileSync(join(dir, "README.md"), "readme v1");
  writeFileSync(join(dir, "src.ts"), "code v1");
  writeSources({
    docs: ["README.md"],
    code: ["src.ts"],
    signals: { stars: 100 },
    broadness: "web",
  });
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function capture(): { out: string[]; restore: () => void } {
  const out: string[] = [];
  const spy = vi.spyOn(console, "log").mockImplementation((m) => out.push(String(m)));
  return { out, restore: () => spy.mockRestore() };
}

describe("runState", () => {
  it("first run: reports all stale and writes state.json", () => {
    const { out, restore } = capture();
    const code = runState(["--target", dir, "--sources", sources]);
    restore();
    expect(code).toBe(0);
    expect(existsSync(statePath(dir))).toBe(true);
    const verdict = JSON.parse(out[0]);
    expect(verdict).toMatchObject({ essence: true, success: true, landscape: true, firstRun: true });
  });

  it("second run with no changes: reports nothing stale", () => {
    runState(["--target", dir, "--sources", sources]);
    const { out, restore } = capture();
    const code = runState(["--target", dir, "--sources", sources]);
    restore();
    expect(code).toBe(0);
    expect(JSON.parse(out[0])).toMatchObject({ essence: false, success: false, landscape: false });
  });

  it("re-run after a docs change: only essence stale", () => {
    runState(["--target", dir, "--sources", sources]);
    writeFileSync(join(dir, "README.md"), "readme v2");
    const { out, restore } = capture();
    runState(["--target", dir, "--sources", sources]);
    restore();
    expect(JSON.parse(out[0])).toMatchObject({ essence: true, success: false, landscape: false });
  });

  it("--dry-run reports staleness but does NOT write state.json", () => {
    const { out, restore } = capture();
    const code = runState(["--target", dir, "--sources", sources, "--dry-run"]);
    restore();
    expect(code).toBe(0);
    expect(existsSync(statePath(dir))).toBe(false);
    expect(JSON.parse(out[0]).firstRun).toBe(true);
  });

  it("--full forces all stale even when nothing changed", () => {
    runState(["--target", dir, "--sources", sources]);
    const { out, restore } = capture();
    runState(["--target", dir, "--sources", sources, "--full"]);
    restore();
    expect(JSON.parse(out[0])).toMatchObject({ essence: true, success: true, landscape: true });
  });

  it("exits 2 on missing flags", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(runState(["--target", dir])).toBe(2);
  });

  it("--dry-run does not overwrite an existing state.json", () => {
    runState(["--target", dir, "--sources", sources]); // real run writes state
    const before = readFileSync(statePath(dir), "utf8");
    writeFileSync(join(dir, "README.md"), "readme v2"); // change docs so fingerprints differ
    const { restore } = capture();
    runState(["--target", dir, "--sources", sources, "--dry-run"]);
    restore();
    expect(readFileSync(statePath(dir), "utf8")).toBe(before); // unchanged on disk
  });

  it("exits 2 on a malformed sources file", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    writeFileSync(sources, "{ not json");
    expect(runState(["--target", dir, "--sources", sources])).toBe(2);
  });

  it("exits 2 when sources is missing broadness", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    writeSources({ docs: [], code: [], signals: {} });
    expect(runState(["--target", dir, "--sources", sources])).toBe(2);
  });
});
