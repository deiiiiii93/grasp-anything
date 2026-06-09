import { describe, it, expect } from "vitest";
import { validateBrief } from "@grasp/schema";
import sample from "@grasp/schema/sample-brief.json";
import { atlasToMarkdown } from "../atlasToMarkdown";
import { atlasToHtml } from "../atlasToHtml";

const doc = validateBrief(sample).data!;

describe("atlasToMarkdown", () => {
  const md = atlasToMarkdown(doc);
  it("renders a heading per continent and bullets per landmark", () => {
    expect(md).toContain("### Architecture");
    expect(md).toContain("Schema validator");
    expect(md).toContain("#### Deterministic core");
  });
  it("escapes markdown link-breaking chars in hostile names", () => {
    const d = JSON.parse(JSON.stringify(sample));
    d.atlas.continents[0].cities[0].landmarks[0].name = "Evil ]( [x](javascript:alert(1))";
    const out = atlasToMarkdown(validateBrief(d).data!);
    expect(out).not.toContain("](javascript:");
  });
});

describe("atlasToHtml", () => {
  const html = atlasToHtml(doc);
  it("renders escaped section markup", () => {
    expect(html).toContain("<h3");
    expect(html).toContain("Schema validator");
  });
  it("entity-escapes hostile names", () => {
    const d = JSON.parse(JSON.stringify(sample));
    d.atlas.continents[0].title = "<script>x</script>";
    const out = atlasToHtml(validateBrief(d).data!);
    expect(out).toContain("&lt;script&gt;");
    expect(out).not.toContain("<script>x");
  });
});
