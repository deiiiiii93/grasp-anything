import { forceLayout, estimateLabelWidth, type ForceNodeInput } from "./force";

const nodes: ForceNodeInput[] = [
  { id: "root", pinned: true, radius: 22 },
  { id: "a", labelWidth: 80 },
  { id: "b", labelWidth: 80 },
  { id: "c", labelWidth: 80 },
  { id: "d", labelWidth: 80 },
  { id: "e", labelWidth: 80 },
];
const links = [
  { source: "root", target: "a" },
  { source: "root", target: "b" },
  { source: "root", target: "c" },
  { source: "a", target: "d" },
  { source: "b", target: "e" },
];

describe("forceLayout", () => {
  it("is deterministic (same input → byte-identical positions)", () => {
    const a = forceLayout(nodes, links, 640, 480);
    const b = forceLayout(nodes, links, 640, 480);
    for (const id of a.keys()) {
      expect(b.get(id)).toEqual(a.get(id));
    }
  });

  it("pins the pinned node at the exact center", () => {
    const pos = forceLayout(nodes, links, 640, 480);
    expect(pos.get("root")).toEqual({ x: 320, y: 240 });
  });

  it("keeps every node finite and within the padded canvas", () => {
    const pos = forceLayout(nodes, links, 640, 480);
    expect(pos.size).toBe(nodes.length);
    for (const p of pos.values()) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
      expect(p.x).toBeGreaterThanOrEqual(36);
      expect(p.x).toBeLessThanOrEqual(640 - 36);
      expect(p.y).toBeGreaterThanOrEqual(36);
      expect(p.y).toBeLessThanOrEqual(480 - 36);
    }
  });

  it("separates nodes (no two centers collapse onto each other)", () => {
    const pos = forceLayout(nodes, links, 640, 480);
    const pts = [...pos.values()];
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dist = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        expect(dist).toBeGreaterThan(28);
      }
    }
  });

  it("places nodes on similarity rings when targetRadius is set", () => {
    const radial: ForceNodeInput[] = [
      { id: "self", pinned: true, radius: 22 },
      { id: "near", targetRadius: 80 },
      { id: "far", targetRadius: 170 },
    ];
    const pos = forceLayout(radial, [], 640, 480);
    const d = (id: string) => Math.hypot(pos.get(id)!.x - 320, pos.get(id)!.y - 240);
    expect(d("near")).toBeLessThan(d("far"));
  });
});

describe("estimateLabelWidth", () => {
  it("scales with length but caps for long labels", () => {
    expect(estimateLabelWidth("short")).toBeLessThan(estimateLabelWidth("a much longer label here"));
    expect(estimateLabelWidth("x".repeat(1000))).toBe(180);
  });
});
