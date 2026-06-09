import { describe, it, expect } from "vitest";
import { atlasToMermaid } from "./mermaid";
import type { BriefDoc } from "@grasp/schema";

function doc(): BriefDoc {
  return {
    meta: { repo: "r", depth: "skim", broadness: "offline", signals: {} },
    brief: { idea: "i", problem: "p", why: "w", how: "h", takeaway: "t" },
    atlas: { continents: [
      { id: "c_wf", domain: "workflows", title: "Workflows", summary: "s", evidenceIds: [],
        cities: [{ id: "a", name: "Ingest", evidenceIds: [], landmarks: [] }, { id: "b", name: "Render <x>", evidenceIds: [], landmarks: [] }],
        flows: [{ id: "f1", source: "a", target: "b", type: "next", label: "then" }] },
      { id: "c_arch", domain: "architecture", title: "Architecture", summary: "s", evidenceIds: [], cities: [], flows: [] },
    ] },
    landscapeGraph: { nodes: [{ id: "self", type: "self", label: "r" }], edges: [] },
    evidence: [],
  } as unknown as BriefDoc;
}

describe("atlasToMermaid", () => {
  it("emits one diagram per continent that HAS flows", () => {
    const out = atlasToMermaid(doc());
    expect(out).toHaveLength(1);
    expect(out[0].continentTitle).toBe("Workflows");
    expect(out[0].diagram).toMatch(/^flowchart LR/);
    expect(out[0].diagram).toContain('a["Ingest"]');
    expect(out[0].diagram).toContain("a -->|then| b");
  });
  it("escapes untrusted node labels", () => {
    const out = atlasToMermaid(doc());
    expect(out[0].diagram).toContain("Render &lt;x&gt;"); // not a raw <x>
    expect(out[0].diagram).not.toContain("Render <x>");
  });
  it("returns [] when no continent has flows", () => {
    const d = doc(); d.atlas.continents[0].flows = [] as never;
    expect(atlasToMermaid(d)).toEqual([]);
  });
});
