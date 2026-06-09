import { describe, it, expect } from "vitest";
import { validateBrief } from "@grasp/schema";
import sample from "@grasp/schema/sample-brief.json";
import { briefToMarkdown } from "../markdown";

const doc = validateBrief(sample).data!;
const md = briefToMarkdown(doc);

describe("briefToMarkdown", () => {
  it("titles with the repo and the takeaway verdict", () => {
    expect(md).toContain(`# ${doc.meta.repo}`);
    expect(md).toContain(`> ${doc.brief.takeaway}`);
  });

  it("includes all five answer sections", () => {
    for (const heading of ["## Idea", "## Problem", "## Why it wins", "## How", "## Takeaway"]) {
      expect(md).toContain(heading);
    }
  });

  it("renders the atlas outline and the competitive landscape mermaid block", () => {
    expect(md).toContain("## How it works");
    expect(md).toContain("Schema validator");
    expect(md).toContain("## Competitive landscape");
    expect((md.match(/```mermaid/g) ?? []).length).toBe(1);
  });

  it("footnotes cited evidence with a verified/inferred tag", () => {
    expect(md).toContain("[^ev1]");
    expect(md).toMatch(/\[\^ev1\]:.*\(verified\)/);
  });

  it("is deterministic (same brief → identical markdown)", () => {
    expect(briefToMarkdown(doc)).toBe(md);
  });
});
