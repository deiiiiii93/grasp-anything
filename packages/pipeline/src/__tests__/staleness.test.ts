import { describe, it, expect } from "vitest";
import { diffStaleness, type Fingerprints } from "../staleness";
import type { GraspState } from "../state";

const prior: GraspState = {
  version: 1,
  docsHash: "d",
  codeHash: "c",
  signalsHash: "s",
  broadness: "web",
};
const same: Fingerprints = { docsHash: "d", codeHash: "c", signalsHash: "s", broadness: "web" };

describe("diffStaleness", () => {
  it("marks everything stale on a first run (no prior)", () => {
    expect(diffStaleness(null, same)).toEqual({
      essence: true,
      success: true,
      landscape: true,
      firstRun: true,
    });
  });

  it("marks everything stale with --full", () => {
    const r = diffStaleness(prior, same, { full: true });
    expect(r.essence && r.success && r.landscape).toBe(true);
    expect(r.firstRun).toBe(false);
  });

  it("marks nothing stale when nothing changed", () => {
    expect(diffStaleness(prior, same)).toEqual({
      essence: false,
      success: false,
      landscape: false,
      firstRun: false,
    });
  });

  it("marks only essence stale when docs change", () => {
    const r = diffStaleness(prior, { ...same, docsHash: "d2" });
    expect(r).toMatchObject({ essence: true, success: false, landscape: false });
  });

  it("marks only essence stale when code changes", () => {
    const r = diffStaleness(prior, { ...same, codeHash: "c2" });
    expect(r).toMatchObject({ essence: true, success: false, landscape: false });
  });

  it("marks only success stale when signals change", () => {
    const r = diffStaleness(prior, { ...same, signalsHash: "s2" });
    expect(r).toMatchObject({ essence: false, success: true, landscape: false });
  });

  it("marks landscape stale only on broadness change or --refresh-landscape", () => {
    expect(diffStaleness(prior, { ...same, broadness: "offline" }).landscape).toBe(true);
    expect(diffStaleness(prior, same, { refreshLandscape: true }).landscape).toBe(true);
    expect(diffStaleness(prior, { ...same, docsHash: "d2" }).landscape).toBe(false);
  });
});
