import { describe, it, expect } from "vitest";
import sample from "../../sample-brief.json";
import { BriefDocSchema } from "../schema";

describe("BriefDocSchema", () => {
  it("accepts the golden sample brief and preserves its data", () => {
    const result = BriefDocSchema.safeParse(sample);
    if (!result.success) {
      console.error(result.error.issues);
    }
    expect(result.success).toBe(true);
    expect(result.data?.meta.repo).toBe("Lum1104/Understand-Anything");
    expect(result.data?.atlas.continents.length).toBe(6);
    expect(result.data?.landscapeGraph.nodes.length).toBe(4);
  });
});

function clone() {
  return JSON.parse(JSON.stringify(sample)) as any;
}

describe("cross-field rules", () => {
  it("rejects zero self nodes", () => {
    const bad = clone();
    bad.landscapeGraph.nodes = bad.landscapeGraph.nodes.filter((n: any) => n.type !== "self");
    const r = BriefDocSchema.safeParse(bad);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r).toLowerCase()).toContain("exactly one 'self'");
  });

  it("rejects a landscape edge with a dangling endpoint", () => {
    const bad = clone();
    bad.landscapeGraph.edges.push({ id: "leX", source: "self1", target: "ghost", type: "competesWith" });
    const r = BriefDocSchema.safeParse(bad);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r)).toContain("ghost");
  });

  it("rejects a node referencing missing evidence", () => {
    const bad = clone();
    bad.landscapeGraph.nodes[0].evidenceIds = ["ghost"];
    const r = BriefDocSchema.safeParse(bad);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r)).toContain("ghost");
  });

  it("rejects an alternative node missing name or url", () => {
    const bad = clone();
    delete bad.landscapeGraph.nodes.find((n: any) => n.id === "alt1").url;
    const r = BriefDocSchema.safeParse(bad);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r).toLowerCase()).toContain("alternative");
  });

  it("rejects a self node missing a name", () => {
    const bad = clone();
    delete bad.landscapeGraph.nodes.find((n: any) => n.id === "self1").name;
    const r = BriefDocSchema.safeParse(bad);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r).toLowerCase()).toContain("self node");
  });

  it("rejects a category node missing a label", () => {
    const bad = clone();
    delete bad.landscapeGraph.nodes.find((n: any) => n.id === "cat1").label;
    const r = BriefDocSchema.safeParse(bad);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r).toLowerCase()).toContain("category node");
  });
});

describe("brief.evidence", () => {
  it("accepts the golden sample whose brief cites evidence", () => {
    const result = BriefDocSchema.safeParse(sample);
    expect(result.success).toBe(true);
    expect(result.data?.brief.evidence?.why).toEqual(["ev1"]);
  });

  it("rejects a brief.evidence reference to missing evidence", () => {
    const bad = clone();
    bad.brief.evidence = { why: ["ghost"] };
    const r = BriefDocSchema.safeParse(bad);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r)).toContain("ghost");
  });

  it("accepts a brief with no evidence map at all", () => {
    const ok = clone();
    delete ok.brief.evidence;
    const r = BriefDocSchema.safeParse(ok);
    expect(r.success).toBe(true);
  });
});
