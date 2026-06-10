import { describe, it, expect } from "vitest";
import { buildAtlasView } from "./atlas";
import { buildVoyage } from "./voyage";
import { sampleDoc } from "../test-utils/sample";

const view = buildAtlasView(sampleDoc);

describe("buildVoyage", () => {
  it("opens at orbit and ends with an outro at orbit", () => {
    const stops = buildVoyage(view);
    expect(stops[0]).toMatchObject({ kind: "orbit", id: null });
    expect(stops[stops.length - 1]).toMatchObject({ kind: "outro", id: null });
  });

  it("visits all six continents in canonical domain order with chapters", () => {
    const stops = buildVoyage(view);
    const conts = stops.filter((s) => s.kind === "continent");
    expect(conts.map((s) => s.title)).toEqual([
      "Architecture", "Modules", "Workflows", "Business Flows", "Technical Selection", "UI/UX Taste",
    ]);
    expect(conts.map((s) => s.chapter)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(conts[0].concept).toMatch(/Great Wall/);
  });

  it("follows each continent with a spotlight landmark that has whyItMatters", () => {
    const stops = buildVoyage(view);
    const archIdx = stops.findIndex((s) => s.kind === "continent" && s.title === "Architecture");
    const next = stops[archIdx + 1];
    expect(next.kind).toBe("landmark");
    expect(next.chapter).toBe(1);
    expect(next.body.length).toBeGreaterThan(0);
  });

  it("skips continents missing from the brief and is deterministic", () => {
    const thin = JSON.parse(JSON.stringify(sampleDoc));
    thin.atlas.continents = thin.atlas.continents.filter((c: { domain: string }) => c.domain !== "modules");
    const stops = buildVoyage(buildAtlasView(thin));
    expect(stops.filter((s) => s.kind === "continent").length).toBe(5);
    expect(buildVoyage(view)).toEqual(buildVoyage(view));
  });
});
