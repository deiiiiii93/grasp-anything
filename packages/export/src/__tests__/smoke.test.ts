import { describe, it, expect } from "vitest";
import { EXPORT_VERSION } from "../index";
import { validateBrief } from "@grasp/schema";
import sample from "@grasp/schema/sample-brief.json";
import { layoutConcept } from "@grasp/dashboard/adapters";

describe("export package wiring", () => {
  it("exposes its version", () => {
    expect(EXPORT_VERSION).toBe("0.1.0");
  });

  it("can reuse the dashboard layout adapter (no React pulled in)", () => {
    const doc = validateBrief(sample).data!;
    const layout = layoutConcept(doc);
    expect(layout.nodes.length).toBeGreaterThan(0);
    expect(Number.isFinite(layout.nodes[0].x)).toBe(true);
  });
});
