import type { BriefDoc } from "@grasp/schema";
import { safeHref } from "./url";

const LANDSCAPE_CLASSDEF = [
  "classDef self fill:#f5c451,stroke:#caa23c,color:#1a1a1a;",
  "classDef alternative fill:#5aa9f0,stroke:#3f86c9,color:#1a1a1a;",
  "classDef category fill:#d8dee9,stroke:#aab4c4,color:#1a1a1a;",
];

/**
 * Mermaid node labels come from an untrusted brief and are wrapped in `["..."]`,
 * so all HTML-significant characters become entities (a label like `<script>` must
 * not survive into the block for a loose-mode renderer to execute) and whitespace collapses.
 */
function label(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\s+/g, " ")
    .trim();
}

/** Node ids are emitted as bare Mermaid identifiers; untrusted ids are reduced to a safe slug so they can't inject syntax. (Applied consistently to node, edge, and click references.) */
function nodeId(id: string): string {
  return id.replace(/[^A-Za-z0-9_]/g, "_");
}

export interface AtlasFlowDiagram { continentTitle: string; diagram: string; }

/** One Mermaid flowchart per continent that has flows. Node labels = the referenced
 *  city/landmark names (escaped); edges = `source -->|type| target` with optional label. */
export function atlasToMermaid(doc: BriefDoc): AtlasFlowDiagram[] {
  const out: AtlasFlowDiagram[] = [];
  for (const c of doc.atlas.continents) {
    if (c.flows.length === 0) continue;
    const nameById = new Map<string, string>();
    for (const city of c.cities) {
      nameById.set(city.id, city.name);
      for (const lm of city.landmarks) nameById.set(lm.id, lm.name);
    }
    const lines = ["flowchart LR"];
    const seen = new Set<string>();
    const emitNode = (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      lines.push(`  ${nodeId(id)}["${label(nameById.get(id) ?? id)}"]`);
    };
    for (const fl of c.flows) { emitNode(fl.source); emitNode(fl.target); }
    for (const fl of c.flows) {
      const lbl = fl.label ? ` ${label(fl.label)} ` : ` ${fl.type} `;
      lines.push(`  ${nodeId(fl.source)} -->|${lbl.trim()}| ${nodeId(fl.target)}`);
    }
    out.push({ continentTitle: c.title, diagram: lines.join("\n") });
  }
  return out;
}

export function landscapeToMermaid(doc: BriefDoc): string {
  const lines = ["flowchart LR"];
  for (const n of doc.landscapeGraph.nodes) {
    const text = n.name ?? n.label ?? n.id;
    lines.push(`  ${nodeId(n.id)}["${label(text)}"]:::${n.type}`);
  }
  for (const e of doc.landscapeGraph.edges) {
    lines.push(`  ${nodeId(e.source)} -->|${e.type}| ${nodeId(e.target)}`);
  }
  for (const n of doc.landscapeGraph.nodes) {
    if (n.type === "alternative" && n.url) {
      lines.push(`  click ${nodeId(n.id)} "${safeHref(n.url)}" _blank`);
    }
  }
  for (const c of LANDSCAPE_CLASSDEF) lines.push(`  ${c}`);
  return lines.join("\n");
}
