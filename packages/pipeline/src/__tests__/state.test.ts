import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readState, writeState, statePath, type GraspState } from "../state";

const sample: GraspState = {
  version: 1,
  docsHash: "d",
  codeHash: "c",
  signalsHash: "s",
  broadness: "web",
};

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "grasp-state-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("state", () => {
  it("round-trips through write then read", () => {
    writeState(dir, sample);
    expect(readState(dir)).toEqual(sample);
  });

  it("writes to <dir>/.grasp/state.json", () => {
    writeState(dir, sample);
    expect(statePath(dir)).toBe(join(dir, ".grasp", "state.json"));
  });

  it("returns null when state is missing", () => {
    expect(readState(dir)).toBeNull();
  });

  it("returns null on corrupt JSON (treated as a full run)", () => {
    mkdirSync(join(dir, ".grasp"), { recursive: true });
    writeFileSync(statePath(dir), "{ not json", "utf8");
    expect(readState(dir)).toBeNull();
  });

  it("returns null on a schema mismatch / old version", () => {
    mkdirSync(join(dir, ".grasp"), { recursive: true });
    writeFileSync(statePath(dir), JSON.stringify({ version: 0 }), "utf8");
    expect(readState(dir)).toBeNull();
  });
});
