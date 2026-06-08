import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashFiles, hashSignals } from "../fingerprint";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "grasp-fp-"));
  mkdirSync(join(dir, "docs"), { recursive: true });
  writeFileSync(join(dir, "README.md"), "hello");
  writeFileSync(join(dir, "docs", "a.md"), "world");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("hashFiles", () => {
  it("is stable for identical content", () => {
    expect(hashFiles(dir, ["README.md", "docs/a.md"])).toBe(
      hashFiles(dir, ["README.md", "docs/a.md"]),
    );
  });

  it("is order-independent", () => {
    expect(hashFiles(dir, ["README.md", "docs/a.md"])).toBe(
      hashFiles(dir, ["docs/a.md", "README.md"]),
    );
  });

  it("changes when a file's content changes", () => {
    const before = hashFiles(dir, ["README.md"]);
    writeFileSync(join(dir, "README.md"), "HELLO");
    expect(hashFiles(dir, ["README.md"])).not.toBe(before);
  });

  it("changes when the set of files changes", () => {
    expect(hashFiles(dir, ["README.md"])).not.toBe(
      hashFiles(dir, ["README.md", "docs/a.md"]),
    );
  });

  it("tolerates a missing file deterministically", () => {
    expect(hashFiles(dir, ["nope.md"])).toBe(hashFiles(dir, ["nope.md"]));
  });
});

describe("hashSignals", () => {
  it("is independent of key order", () => {
    expect(hashSignals({ stars: 10, language: "TS" })).toBe(
      hashSignals({ language: "TS", stars: 10 }),
    );
  });

  it("changes when a value changes", () => {
    expect(hashSignals({ stars: 10 })).not.toBe(hashSignals({ stars: 11 }));
  });

  it("treats undefined as an empty object", () => {
    expect(hashSignals(undefined)).toBe(hashSignals({}));
  });
});
