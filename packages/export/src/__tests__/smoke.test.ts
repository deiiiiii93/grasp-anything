import { describe, it, expect } from "vitest";
import { EXPORT_VERSION } from "../index";
import { validateBrief } from "@grasp/schema";
import sample from "@grasp/schema/sample-brief.json";
import { atlasToMarkdown } from "../atlasToMarkdown";

describe("export package wiring", () => {
  it("exposes its version", () => {
    expect(EXPORT_VERSION).toBe("0.1.0");
  });

  it("can render the atlas outline (no React pulled in)", () => {
    const doc = validateBrief(sample).data!;
    const md = atlasToMarkdown(doc);
    expect(md).toContain("## How it works");
    expect(md).toContain("Schema validator");
  });
});
