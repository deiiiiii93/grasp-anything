import { buildBillboards, staggerOffsetPx } from "./billboards";
import { buildAtlasView, selectionContext } from "../adapters/atlas";
import { sampleDoc } from "../test-utils/sample";

const view = buildAtlasView(sampleDoc);

describe("buildBillboards", () => {
  it("orbit level: only continent billboards, with the diorama sprites", () => {
    const bbs = buildBillboards(view, selectionContext(view, null));
    expect(bbs).toHaveLength(view.continents.length);
    expect(bbs.every((b) => b.tier === "continent")).toBe(true);
    expect(bbs.find((b) => b.id === "c_arch")?.spriteUrl).toBe("./atlas/landmarks/architecture.png");
  });

  it("continent selected: adds only that continent's cities, with emblem sprites and anchored labels", () => {
    const bbs = buildBillboards(view, selectionContext(view, "c_arch"));
    const cities = bbs.filter((b) => b.tier === "city");
    expect(cities.length).toBeGreaterThan(0);
    expect(cities.every((b) => b.spriteUrl === "./atlas/cities/architecture.png")).toBe(true);
    expect(cities.find((b) => b.id === "city_core")?.label).toBe("Deterministic core · Beijing");
    expect(bbs.some((b) => b.tier === "landmark")).toBe(false);
  });

  it("city selected: adds its landmarks with pin sprites and per-city stagger indices", () => {
    const bbs = buildBillboards(view, selectionContext(view, "city_core"));
    const lms = bbs.filter((b) => b.tier === "landmark");
    expect(lms.map((b) => b.id)).toEqual(["lm_validator", "lm_assemble"]);
    expect(lms.every((b) => b.spriteUrl === "./atlas/pins/architecture.png")).toBe(true);
    expect(lms.map((b) => b.staggerIndex)).toEqual([0, 1]);
  });
});

describe("staggerOffsetPx", () => {
  it("steps ring-neighbors to different depths below the pin: 0, 14, 28, 0", () => {
    const mk = (i: number) =>
      ({ tier: "landmark", staggerIndex: i } as Parameters<typeof staggerOffsetPx>[0]);
    expect([0, 1, 2, 3].map((i) => staggerOffsetPx(mk(i)))).toEqual([0, 14, 28, 0]);
    expect(staggerOffsetPx({ tier: "city", staggerIndex: 0 } as Parameters<typeof staggerOffsetPx>[0])).toBe(0);
  });
});
