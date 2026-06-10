import { ANCHOR_CITIES, buildAtlasView, CONTINENT_GEO, DOMAIN_STORY, relatedFlows } from "./atlas";
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

  it("docks every city at one of its continent's real anchor cities", () => {
    const view = buildAtlasView(sampleDoc);
    const contById = new Map(view.continents.map((c) => [c.id, c]));
    for (const city of view.cities) {
      const anchors = ANCHOR_CITIES[contById.get(city.continentId)!.domain];
      const anchor = anchors.find((a) => a.name === city.anchorName)!;
      expect(anchor).toBeDefined();
      expect(city.lat).toBe(anchor.lat);
      expect(city.lng).toBe(anchor.lng);
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

  it("cities and landmarks carry their continent's domain (renderer maps domain → sprite)", () => {
    const view = buildAtlasView(sampleDoc);
    const city = view.cities.find((c) => c.id === "city_core");
    expect(city?.domain).toBe("architecture");
    const lm = view.landmarks.find((l) => l.id === "lm_validator");
    expect(lm?.domain).toBe("architecture");
  });

  it("DOMAIN_STORY covers all six domains with non-empty concept and lesson", () => {
    const domains = ["architecture", "modules", "workflows", "businessFlows", "techSelection", "uiUxTaste"] as const;
    for (const d of domains) {
      expect(DOMAIN_STORY[d].concept.trim().length).toBeGreaterThan(0);
      expect(DOMAIN_STORY[d].lesson.trim().length).toBeGreaterThan(0);
    }
  });

  it("resolves the golden sample's flows into same-continent arcs", () => {
    const view = buildAtlasView(sampleDoc);
    const flows = view.arcs.filter((a) => a.kind === "flow");
    expect(flows.length).toBe(6);
    expect(new Set(flows.map((a) => a.continentId))).toEqual(new Set(["c_wf", "c_biz"]));
    // One hierarchy spoke per landmark, network-ready.
    expect(view.arcs.filter((a) => a.kind === "spoke").length).toBe(view.landmarks.length);
  });

  it("arcs carry endpoint ids and human names", () => {
    const view = buildAtlasView(sampleDoc);
    const arc = view.arcs.find((a) => a.id === "f_wf1")!;
    expect(arc).toMatchObject({ sourceId: "lm_wizard", targetId: "lm_dispatch" });
    expect(arc.sourceName).toBe("Depth wizard");
    expect(arc.targetName).toBe("Parallel dispatch");
  });

  it("relatedFlows returns arcs touching a landmark, and all arcs of a continent", () => {
    const view = buildAtlasView(sampleDoc);
    expect(relatedFlows(view, "lm_dispatch").map((a) => a.id).sort()).toEqual(["f_wf1", "f_wf2"]);
    expect(relatedFlows(view, "c_biz").length).toBe(3);
    expect(relatedFlows(view, null)).toEqual([]);
  });
});
