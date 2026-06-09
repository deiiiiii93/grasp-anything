import { describe, it, expect } from "vitest";
import { validateBrief } from "../index";
import sample from "../../sample-brief.json";

function withAtlas(atlas: unknown) {
  const doc = JSON.parse(JSON.stringify(sample));
  doc.atlas = atlas;
  return doc;
}

const oneContinent = {
  continents: [
    {
      id: "c1", domain: "architecture", title: "Architecture",
      summary: "How it is structured.", evidenceIds: ["ev1"],
      cities: [
        { id: "city1", name: "Core", evidenceIds: [],
          landmarks: [{ id: "lm1", name: "Validator", detail: "x", evidenceIds: [] }] },
      ],
      flows: [],
    },
  ],
};

describe("atlas schema", () => {
  it("accepts the golden sample", () => {
    expect(validateBrief(sample).ok).toBe(true);
  });

  it("rejects a brief with no atlas", () => {
    const doc = JSON.parse(JSON.stringify(sample));
    delete doc.atlas;
    expect(validateBrief(doc).ok).toBe(false);
  });

  it("rejects duplicate continent domains", () => {
    const atlas = JSON.parse(JSON.stringify(oneContinent));
    atlas.continents.push(JSON.parse(JSON.stringify(atlas.continents[0])));
    atlas.continents[1].id = "c2";
    const r = validateBrief(withAtlas(atlas));
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/domain .*architecture.* unique|duplicate/i);
  });

  it("rejects duplicate ids across levels", () => {
    const atlas = JSON.parse(JSON.stringify(oneContinent));
    atlas.continents[0].cities[0].landmarks[0].id = "city1";
    const r = validateBrief(withAtlas(atlas));
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/duplicate id .*city1/i);
  });

  it("rejects an evidence id that does not resolve", () => {
    const atlas = JSON.parse(JSON.stringify(oneContinent));
    atlas.continents[0].evidenceIds = ["nope"];
    expect(validateBrief(withAtlas(atlas)).ok).toBe(false);
  });

  it("rejects a flow endpoint outside its continent", () => {
    const atlas = JSON.parse(JSON.stringify(oneContinent));
    atlas.continents[0].flows = [
      { id: "fl1", source: "lm1", target: "elsewhere", type: "next" },
    ];
    const r = validateBrief(withAtlas(atlas));
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/flow .*elsewhere/i);
  });

  it("accepts a sparse continent (zero cities)", () => {
    const atlas = JSON.parse(JSON.stringify(oneContinent));
    atlas.continents[0].cities = [];
    expect(validateBrief(withAtlas(atlas)).ok).toBe(true);
  });

  it("rejects a whitespace-only title (non-empty after trimming)", () => {
    const atlas = JSON.parse(JSON.stringify(oneContinent));
    atlas.continents[0].title = "   ";
    expect(validateBrief(withAtlas(atlas)).ok).toBe(false);
  });

  it("rejects duplicate flow ids (consistent with other levels)", () => {
    const atlas = JSON.parse(JSON.stringify(oneContinent));
    atlas.continents[0].flows = [
      { id: "fl1", source: "lm1", target: "city1", type: "next" },
      { id: "fl1", source: "city1", target: "lm1", type: "next" },
    ];
    const r = validateBrief(withAtlas(atlas));
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/duplicate id .*fl1/i);
  });
});
