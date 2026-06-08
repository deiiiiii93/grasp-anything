import { describe, it, expect } from "vitest";
import {
  EssenceFragmentSchema,
  SuccessFragmentSchema,
  LandscapeFragmentSchema,
} from "../fragments";

const validEssence = {
  idea: "Turn a repo into a knowledge graph.",
  problem: "Onboarding into a codebase is slow.",
  how: "LLM agents emit a validated JSON graph.",
  conceptGraph: {
    nodes: [
      { id: "idea1", type: "idea", label: "Repo as a graph" },
      { id: "p1", type: "problem", label: "Hard to onboard" },
    ],
    edges: [{ id: "ce1", source: "idea1", target: "p1", type: "addresses" }],
  },
};

describe("EssenceFragmentSchema", () => {
  it("accepts a valid essence fragment and fills defaults", () => {
    const parsed = EssenceFragmentSchema.parse(validEssence);
    expect(parsed.evidence).toEqual([]);
    expect(parsed.briefEvidence).toEqual({});
    expect(parsed.conceptGraph.nodes[0].detail).toBe("");
    expect(parsed.conceptGraph.nodes[0].evidenceIds).toEqual([]);
  });

  it("rejects a fragment missing the 'how' prose", () => {
    const { how, ...rest } = validEssence;
    expect(EssenceFragmentSchema.safeParse(rest).success).toBe(false);
  });
});

describe("SuccessFragmentSchema", () => {
  it("accepts why + takeaway", () => {
    const parsed = SuccessFragmentSchema.parse({
      why: "One command, polished output.",
      takeaway: "Worth it for large repos.",
    });
    expect(parsed.evidence).toEqual([]);
    expect(parsed.briefEvidence).toEqual({});
  });

  it("rejects an empty 'why'", () => {
    expect(
      SuccessFragmentSchema.safeParse({ why: "", takeaway: "x" }).success,
    ).toBe(false);
  });
});

describe("LandscapeFragmentSchema", () => {
  it("accepts a self-only landscape graph", () => {
    const parsed = LandscapeFragmentSchema.parse({
      landscapeGraph: {
        nodes: [{ id: "self", type: "self", name: "Repo" }],
        edges: [],
      },
    });
    expect(parsed.evidence).toEqual([]);
    expect(parsed.landscapeGraph.nodes[0].evidenceIds).toEqual([]);
  });
});
