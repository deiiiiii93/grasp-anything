import { describe, it, expect } from "vitest";
import { validateBrief } from "@grasp/schema";
import sample from "@grasp/schema/sample-brief.json";
import { conceptToMermaid, landscapeToMermaid } from "../mermaid";

const doc = validateBrief(sample).data!;

describe("conceptToMermaid", () => {
  const out = conceptToMermaid(doc);
  it("starts a top-down flowchart", () => {
    expect(out.startsWith("flowchart TD")).toBe(true);
  });
  it("emits one node line per concept node with a type class", () => {
    for (const n of doc.conceptGraph.nodes) {
      expect(out).toContain(`${n.id}["`);
      expect(out).toContain(`]:::${n.type}`);
    }
  });
  it("emits one edge line per concept edge labelled by relation", () => {
    for (const e of doc.conceptGraph.edges) {
      expect(out).toContain(`${e.source} -->|${e.type}| ${e.target}`);
    }
  });
  it("includes classDef styling for node types", () => {
    expect(out).toContain("classDef idea");
  });
});

describe("landscapeToMermaid", () => {
  const out = landscapeToMermaid(doc);
  it("starts a left-right flowchart and labels nodes by name", () => {
    expect(out.startsWith("flowchart LR")).toBe(true);
    expect(out).toContain('self1["Understand-Anything"]:::self');
  });
  it("emits a click directive for alternatives with a url", () => {
    expect(out).toContain('click alt1 "https://github.com/sourcegraph/cody" _blank');
  });
});

describe("label escaping", () => {
  it("escapes double quotes in labels", () => {
    const d = JSON.parse(JSON.stringify(sample));
    d.conceptGraph.nodes[0].label = 'a "quoted" label';
    const out = conceptToMermaid(validateBrief(d).data!);
    expect(out).toContain("&quot;quoted&quot;");
    expect(out).not.toContain('"quoted"');
  });
});
