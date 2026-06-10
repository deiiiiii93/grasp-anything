import { describe, it, expect } from "vitest";
import { validateBrief } from "../index";
import sample from "../../sample-brief.json";

const clone = () => JSON.parse(JSON.stringify(sample));

describe("validation warnings", () => {
  it("the golden sample has no warnings", () => {
    const r = validateBrief(sample);
    expect(r.ok).toBe(true);
    expect(r.warnings).toEqual([]);
  });

  it("warns when a continent has a summary but no evidence", () => {
    const doc = clone();
    doc.atlas.continents[1].evidenceIds = [];
    const r = validateBrief(doc);
    expect(r.ok).toBe(true);
    expect(r.warnings.join("\n")).toMatch(/no evidence/i);
  });

  it("warns when a landmark has no detail", () => {
    const doc = clone();
    delete doc.atlas.continents[0].cities[0].landmarks[0].detail;
    expect(validateBrief(doc).warnings.join("\n")).toMatch(/no detail/i);
  });

  it("warns when a city has zero landmarks", () => {
    const doc = clone();
    doc.atlas.continents[0].cities[0].landmarks = [];
    expect(validateBrief(doc).warnings.join("\n")).toMatch(/zero landmarks/i);
  });

  it("warns when fewer than three continents are populated", () => {
    const doc = clone();
    doc.atlas.continents = doc.atlas.continents.slice(0, 2);
    expect(validateBrief(doc).warnings.join("\n")).toMatch(/fewer than three/i);
  });

  it("warns when a populated continent has only one city", () => {
    const doc = clone();
    doc.atlas.continents[0].cities = doc.atlas.continents[0].cities.slice(0, 1);
    expect(validateBrief(doc).warnings.join("\n")).toMatch(/only one city/i);
  });

  it("warns when a landmark has no whyItMatters", () => {
    const doc = clone();
    delete doc.atlas.continents[0].cities[0].landmarks[0].whyItMatters;
    expect(validateBrief(doc).warnings.join("\n")).toMatch(/no whyItMatters/i);
  });

  it("warns when a flow continent has cities but zero flows", () => {
    const doc = clone();
    const flowCont = doc.atlas.continents.find((c: { domain: string }) => c.domain === "workflows");
    flowCont.flows = [];
    expect(validateBrief(doc).warnings.join("\n")).toMatch(/no flows/i);
  });

  it("warns when a landmark cites no evidence", () => {
    const doc = clone();
    doc.atlas.continents[0].cities[0].landmarks[0].evidenceIds = [];
    expect(validateBrief(doc).warnings.join("\n")).toMatch(/cites no evidence/i);
  });

  it("warns when the landmark count exceeds the performance cap", () => {
    const doc = clone();
    const city = doc.atlas.continents[0].cities[0];
    city.landmarks = Array.from({ length: 121 }, (_, i) => ({ id: `g${i}`, name: `g${i}`, detail: "d", evidenceIds: [], tags: [] }));
    expect(validateBrief(doc).warnings.join("\n")).toMatch(/performance cap|too many landmarks/i);
  });
});
