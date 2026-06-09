import { describe, it, expect } from "vitest";
import { validateBrief } from "@grasp/schema";
import sample from "@grasp/schema/sample-brief.json";
import { briefToPrintHtml } from "../printHtml";

const doc = validateBrief(sample).data!;
const html = briefToPrintHtml(doc);

describe("briefToPrintHtml", () => {
  it("is a complete HTML document", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("</html>");
  });

  it("contains all five prose answers", () => {
    for (const key of ["idea", "problem", "why", "how", "takeaway"] as const) {
      expect(html).toContain(doc.brief[key]);
    }
  });

  it("embeds the atlas outline and the landscape svg", () => {
    expect(html).toContain("How it works");
    expect(html).toContain("Schema validator");
    expect((html.match(/<svg /g) ?? []).length).toBe(1);
  });

  it("has a print stylesheet and a references section", () => {
    expect(html).toContain("@media print");
    expect(html).toContain("@page");
    expect(html).toContain("References");
  });

  it("is self-contained (no loaded external assets)", () => {
    expect(html).not.toContain("<script");
    expect(html).not.toContain(" src=");
    expect(html).not.toContain("<link ");
    expect(html).not.toContain("@import");
  });

  it("marks inferred evidence distinctly", () => {
    const d = JSON.parse(JSON.stringify(sample));
    d.evidence[0].verified = false;
    const out = briefToPrintHtml(validateBrief(d).data!);
    expect(out).toContain("inferred");
  });
});
