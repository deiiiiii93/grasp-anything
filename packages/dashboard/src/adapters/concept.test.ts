import { layoutConcept } from "./concept";
import { sampleDoc } from "../test-utils/sample";

describe("layoutConcept", () => {
  it("places the idea node at the center", () => {
    const layout = layoutConcept(sampleDoc, 640, 480);
    const idea = layout.nodes.find((n) => n.type === "idea")!;
    expect(idea).toBeDefined();
    expect(idea.x).toBe(320);
    expect(idea.y).toBe(240);
  });

  it("includes every concept node and edge with finite coordinates", () => {
    const layout = layoutConcept(sampleDoc, 640, 480);
    expect(layout.nodes).toHaveLength(sampleDoc.conceptGraph.nodes.length);
    expect(layout.edges).toHaveLength(sampleDoc.conceptGraph.edges.length);
    for (const n of layout.nodes) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
    }
  });

  it("resolves node evidence (the outcome node cites ev1)", () => {
    const layout = layoutConcept(sampleDoc, 640, 480);
    const outcome = layout.nodes.find((n) => n.id === "o1")!;
    expect(outcome.evidence.map((e) => e.id)).toEqual(["ev1"]);
  });

  it("is deterministic (same input → identical coordinates)", () => {
    const a = layoutConcept(sampleDoc, 640, 480);
    const b = layoutConcept(sampleDoc, 640, 480);
    expect(a.nodes.map((n) => [n.id, n.x, n.y])).toEqual(b.nodes.map((n) => [n.id, n.x, n.y]));
  });
});
