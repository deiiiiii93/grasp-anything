import { layoutLandscape } from "./landscape";
import { sampleDoc } from "../test-utils/sample";

describe("layoutLandscape", () => {
  it("places the self node at the center", () => {
    const layout = layoutLandscape(sampleDoc, 640, 480);
    const self = layout.nodes.find((n) => n.kind === "self")!;
    expect(self.id).toBe("self1");
    expect(self.x).toBe(320);
    expect(self.y).toBe(240);
  });

  it("includes self + alternatives as physical nodes but NOT category nodes", () => {
    const layout = layoutLandscape(sampleDoc, 640, 480);
    expect(layout.nodes.map((n) => n.id).sort()).toEqual(["alt1", "alt2", "self1"]);
    expect(layout.nodes.some((n) => n.kind === "category")).toBe(false);
  });

  it("exposes category nodes as a legend with colors", () => {
    const layout = layoutLandscape(sampleDoc, 640, 480);
    expect(layout.categories).toHaveLength(1);
    expect(layout.categories[0]).toMatchObject({ id: "cat1", label: "Code comprehension tools" });
    expect(typeof layout.categories[0].color).toBe("string");
  });

  it("places a more similar alternative closer to center than a less similar one", () => {
    const layout = layoutLandscape(sampleDoc, 640, 480);
    const cx = 320;
    const cy = 240;
    const dist = (id: string) => {
      const n = layout.nodes.find((x) => x.id === id)!;
      return Math.hypot(n.x - cx, n.y - cy);
    };
    expect(dist("alt2")).toBeLessThan(dist("alt1"));
  });

  it("keeps only edges whose endpoints are physical nodes", () => {
    const layout = layoutLandscape(sampleDoc, 640, 480);
    const ids = new Set(layout.nodes.map((n) => n.id));
    for (const e of layout.edges) {
      expect(ids.has(e.source) && ids.has(e.target)).toBe(true);
    }
    expect(layout.edges).toHaveLength(3);
  });

  it("is deterministic (same input → identical coordinates)", () => {
    const a = layoutLandscape(sampleDoc, 640, 480);
    const b = layoutLandscape(sampleDoc, 640, 480);
    expect(a.nodes.map((n) => [n.id, n.x, n.y])).toEqual(b.nodes.map((n) => [n.id, n.x, n.y]));
  });

  it("falls back to mid radius when an alternative has no similarity", () => {
    const doc = JSON.parse(JSON.stringify(sampleDoc));
    delete doc.landscapeGraph.nodes.find((n: { id: string }) => n.id === "alt1").similarity;
    const layout = layoutLandscape(doc, 640, 480);
    const alt = layout.nodes.find((n) => n.id === "alt1")!;
    // minR 70 + (1 - 0.5 fallback) * (maxR 180 - minR 70) = 125
    expect(Math.hypot(alt.x - 320, alt.y - 240)).toBeCloseTo(125, 5);
  });
});
