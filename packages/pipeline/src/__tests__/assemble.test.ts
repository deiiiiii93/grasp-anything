import { describe, it, expect } from "vitest";
import { validateBrief } from "@grasp/schema";
import { assemble } from "../assemble";
import goldenSample from "@grasp/schema/sample-brief.json";
import meta from "./fixtures/meta.json";
import essence from "./fixtures/essence.json";
import success from "./fixtures/success.json";
import landscape from "./fixtures/landscape.json";

describe("assemble", () => {
  it("reconstructs the golden sample from its three fragments", () => {
    const result = assemble({ meta, essence, success, landscape });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Strong contract check: the three fragments reassemble the exact golden brief.
    // If this reveals only key-ordering/default differences, fix the fixtures —
    // the fragments are the source of truth for what each agent must emit.
    expect(result.doc).toEqual(goldenSample);
  });

  it("produces a brief that passes the full validator", () => {
    const result = assemble({ meta, essence, success, landscape });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(validateBrief(result.doc).ok).toBe(true);
  });

  it("resolves cross-fragment evidence (success.why cites ev1, introduced by essence)", () => {
    const result = assemble({ meta, essence, success, landscape });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doc.brief.evidence).toEqual({ why: ["ev1"] });
    // Essence-introduced evidence first (fragment merge order), landscape's ev2 last.
    expect(result.doc.evidence.map((e) => e.id)).toEqual([
      "ev1", "ev4", "ev5", "ev6", "ev7", "ev8", "ev9", "ev10", "ev11", "ev12", "ev13", "ev14", "ev2",
    ]);
  });

  it("synthesizes a self-only landscape when offline (no landscape fragment)", () => {
    const result = assemble({ meta, essence, success });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const land = result.doc.landscapeGraph;
    expect(land.nodes).toHaveLength(1);
    expect(land.nodes[0].type).toBe("self");
    expect(land.nodes[0].name).toBe("Lum1104/Understand-Anything");
    expect(land.edges).toEqual([]);
    expect(validateBrief(result.doc).ok).toBe(true);
  });

  it("reports prefixed errors for an invalid meta", () => {
    const { repo, ...badMeta } = meta as Record<string, unknown>;
    const result = assemble({ meta: badMeta, essence, success, landscape });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.startsWith("meta.repo"))).toBe(true);
  });

  it("reports prefixed errors for an invalid fragment", () => {
    const badEssence = { ...essence, how: "" };
    const result = assemble({ meta, essence: badEssence, success, landscape });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.startsWith("essence.how"))).toBe(true);
  });

  it("rejects conflicting evidence ids across fragments", () => {
    const clashEssence = {
      ...essence,
      evidence: [{ id: "dup", claim: "A", source: "README", verified: true }],
    };
    const clashSuccess = {
      ...success,
      evidence: [{ id: "dup", claim: "B (different)", source: "GitHub", verified: false }],
      briefEvidence: {},
    };
    const result = assemble({ meta, essence: clashEssence, success: clashSuccess, landscape });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.includes("conflicting"))).toBe(true);
  });
});
