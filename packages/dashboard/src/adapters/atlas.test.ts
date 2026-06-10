import { buildAtlasView, CONTINENT_GEO } from "./atlas";
import { sampleDoc } from "../test-utils/sample";

describe("buildAtlasView", () => {
  it("is deterministic (same doc → identical lat/lng)", () => {
    const a = buildAtlasView(sampleDoc);
    const b = buildAtlasView(sampleDoc);
    expect(b.landmarks.map((l) => [l.id, l.lat, l.lng])).toEqual(
      a.landmarks.map((l) => [l.id, l.lat, l.lng]),
    );
  });

  it("maps each continent's domain to its real-world geography", () => {
    const view = buildAtlasView(sampleDoc);
    const arch = view.continents.find((c) => c.domain === "architecture")!;
    expect(arch).toBeDefined();
    expect(arch.lat).toBe(CONTINENT_GEO.architecture.lat);
    expect(arch.continentName).toBe("Asia");
    expect(arch.motif).toBe("Great Wall");
  });

  it("places every city/landmark within its continent's ring radius", () => {
    const view = buildAtlasView(sampleDoc);
    const contById = new Map(view.continents.map((c) => [c.id, c]));
    for (const city of view.cities) {
      const c = contById.get(city.continentId)!;
      expect(Math.hypot(city.lat - c.lat, city.lng - c.lng)).toBeLessThanOrEqual(40);
    }
  });

  it("builds an outline that mirrors the hierarchy", () => {
    const view = buildAtlasView(sampleDoc);
    const arch = view.outline.find((n) => n.kind === "continent" && n.title === "Architecture")!;
    expect(arch.children.map((c) => c.kind)).toEqual(["city", "city"]);
    expect(arch.children[0].children[0].kind).toBe("landmark");
  });

  it("exposes landmark detail-panel fields", () => {
    const view = buildAtlasView(sampleDoc);
    const lm = view.landmarks.find((l) => l.id === "lm_validator")!;
    expect(lm.whyItMatters).toMatch(/untrusted agent output/);
    expect(lm.techTag).toBe("Zod");
    expect(lm.evidence.map((e) => e.id)).toEqual(["ev13"]);
  });

  it("resolves the golden sample's flows into same-continent arcs", () => {
    const view = buildAtlasView(sampleDoc);
    expect(view.arcs.length).toBe(6);
    const contByArc = new Set(view.arcs.map((a) => a.continentId));
    expect(contByArc).toEqual(new Set(["c_wf", "c_biz"]));
  });
});
