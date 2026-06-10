import { describe, it, expect } from "vitest";
import { validateBrief } from "@grasp/schema";
import sample from "@grasp/schema/sample-brief.json";
import { landscapeToMermaid } from "../mermaid";

const doc = validateBrief(sample).data!;

describe("landscapeToMermaid", () => {
  const out = landscapeToMermaid(doc);
  it("starts a left-right flowchart and labels nodes by name", () => {
    expect(out.startsWith("flowchart LR")).toBe(true);
    expect(out).toContain('self1["grasp"]:::self');
  });
  it("emits a click directive for alternatives with a url", () => {
    expect(out).toContain('click alt1 "https://github.com/sourcegraph/cody" _blank');
  });
});
