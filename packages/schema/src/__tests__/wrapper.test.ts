import { describe, it, expect } from "vitest";
import sample from "../../sample-brief.json";
import { validateBrief } from "../validate";

describe("validateBrief", () => {
  it("returns ok for the golden sample", () => {
    const result = validateBrief(sample);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.data).toBeDefined();
  });

  it("returns flat, readable error strings for an invalid brief", () => {
    const bad = JSON.parse(JSON.stringify(sample));
    bad.brief.idea = "";
    const result = validateBrief(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("brief.idea");
    expect(result.data).toBeUndefined();
  });
});
