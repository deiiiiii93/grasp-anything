import { describe, it, expect } from "vitest";
import { buildAtlasView, selectionContext, visibleAt } from "./atlas";
import type { BriefDoc } from "@grasp/schema";

// Minimal doc with one flow continent (workflows) holding 2 cities + 1 flow city->city.
function docWithFlow(): BriefDoc {
  return {
    meta: { repo: "r", depth: "skim", broadness: "offline", signals: {} },
    brief: { idea: "i", problem: "p", why: "w", how: "h", takeaway: "t" },
    atlas: {
      continents: [
        {
          id: "c_wf", domain: "workflows", title: "Workflows", summary: "s", evidenceIds: [],
          cities: [
            { id: "city_a", name: "Ingest", evidenceIds: [], landmarks: [] },
            { id: "city_b", name: "Render", evidenceIds: [], landmarks: [] },
          ],
          flows: [{ id: "f1", source: "city_a", target: "city_b", type: "next", label: "then" }],
        },
      ],
    },
    landscapeGraph: { nodes: [{ id: "self", type: "self", label: "r" }], edges: [] },
    evidence: [],
  } as unknown as BriefDoc;
}

describe("buildAtlasView flow arcs", () => {
  it("emits one arc per flow with endpoints at the resolved city positions", () => {
    const v = buildAtlasView(docWithFlow());
    expect(v.arcs).toHaveLength(1);
    const arc = v.arcs[0];
    const a = v.cities.find((c) => c.id === "city_a")!;
    const b = v.cities.find((c) => c.id === "city_b")!;
    expect(arc).toMatchObject({
      id: "f1", continentId: "c_wf", type: "next", label: "then",
      startLat: a.lat, startLng: a.lng, endLat: b.lat, endLng: b.lng,
    });
    expect(arc.color).toBe(v.continents.find((c) => c.id === "c_wf")!.color);
  });

  it("is deterministic (same doc → identical arcs)", () => {
    expect(buildAtlasView(docWithFlow()).arcs).toEqual(buildAtlasView(docWithFlow()).arcs);
  });

  it("resolves landmark endpoints too, and skips flows whose endpoint is missing", () => {
    const d = docWithFlow();
    d.atlas.continents[0].cities[0].landmarks = [{ id: "lm_x", name: "X", evidenceIds: [], tags: [] }] as never;
    d.atlas.continents[0].flows = [
      { id: "f2", source: "lm_x", target: "city_b", type: "calls" },
      { id: "f3", source: "nope", target: "city_b", type: "calls" },
    ] as never;
    const v = buildAtlasView(d);
    expect(v.arcs.map((a) => a.id)).toEqual(["f2"]); // f3 dropped (unresolved endpoint)
  });
});

describe("selectionContext", () => {
  const v = buildAtlasView(docWithFlow());
  it("level 1 (orbit) when nothing selected", () => {
    expect(selectionContext(v, null)).toMatchObject({ level: 1, continentId: null });
  });
  it("level 2 (continent) when a continent is selected", () => {
    expect(selectionContext(v, "c_wf")).toMatchObject({ level: 2, continentId: "c_wf" });
  });
  it("level 3 (city) resolves its continent", () => {
    expect(selectionContext(v, "city_a")).toMatchObject({ level: 3, continentId: "c_wf", cityId: "city_a" });
  });
});

describe("visibleAt", () => {
  it("cities show from continent altitude; landmarks+arcs from city altitude", () => {
    expect(visibleAt("city", 1)).toBe(false);
    expect(visibleAt("city", 2)).toBe(true);
    expect(visibleAt("landmark", 2)).toBe(false);
    expect(visibleAt("landmark", 3)).toBe(true);
    expect(visibleAt("arc", 3)).toBe(true);
    expect(visibleAt("arc", 2)).toBe(false);
  });
});
