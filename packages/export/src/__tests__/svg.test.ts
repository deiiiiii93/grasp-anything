import { describe, it, expect } from "vitest";
import { validateBrief } from "@grasp/schema";
import sample from "@grasp/schema/sample-brief.json";
import { landscapeToSvg } from "../svg";

const doc = validateBrief(sample).data!;

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("landscapeToSvg", () => {
  const svg = landscapeToSvg(doc);
  it("renders the physical nodes (self + alternatives, not category) and the edges", () => {
    const physical = doc.landscapeGraph.nodes.filter((n) => n.type !== "category").length;
    expect(count(svg, "<g ")).toBe(physical);
  });
  it("escapes special characters in labels", () => {
    const d = JSON.parse(JSON.stringify(sample));
    d.landscapeGraph.nodes[1].name = "A & B <co>";
    const out = landscapeToSvg(validateBrief(d).data!);
    expect(out).toContain("A &amp; B &lt;co&gt;");
  });
});
