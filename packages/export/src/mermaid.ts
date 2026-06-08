import type { BriefDoc } from "@grasp/schema";
import { safeHref } from "./url";

const CONCEPT_CLASSDEF = [
  "classDef idea fill:#f5c451,stroke:#caa23c,color:#1a1a1a;",
  "classDef problem fill:#e5687a,stroke:#c14f60,color:#1a1a1a;",
  "classDef mechanism fill:#5aa9f0,stroke:#3f86c9,color:#1a1a1a;",
  "classDef outcome fill:#5bd1a0,stroke:#3fad82,color:#1a1a1a;",
  "classDef feature fill:#b794f6,stroke:#9670d8,color:#1a1a1a;",
];

const LANDSCAPE_CLASSDEF = [
  "classDef self fill:#f5c451,stroke:#caa23c,color:#1a1a1a;",
  "classDef alternative fill:#5aa9f0,stroke:#3f86c9,color:#1a1a1a;",
  "classDef category fill:#d8dee9,stroke:#aab4c4,color:#1a1a1a;",
];

/** Mermaid labels are wrapped in double quotes, so quotes inside become entities and newlines collapse. */
function label(text: string): string {
  return text.replace(/"/g, "&quot;").replace(/\s+/g, " ").trim();
}

export function conceptToMermaid(doc: BriefDoc): string {
  const lines = ["flowchart TD"];
  for (const n of doc.conceptGraph.nodes) {
    lines.push(`  ${n.id}["${label(n.label)}"]:::${n.type}`);
  }
  for (const e of doc.conceptGraph.edges) {
    lines.push(`  ${e.source} -->|${e.type}| ${e.target}`);
  }
  for (const c of CONCEPT_CLASSDEF) lines.push(`  ${c}`);
  return lines.join("\n");
}

export function landscapeToMermaid(doc: BriefDoc): string {
  const lines = ["flowchart LR"];
  for (const n of doc.landscapeGraph.nodes) {
    const text = n.name ?? n.label ?? n.id;
    lines.push(`  ${n.id}["${label(text)}"]:::${n.type}`);
  }
  for (const e of doc.landscapeGraph.edges) {
    lines.push(`  ${e.source} -->|${e.type}| ${e.target}`);
  }
  for (const n of doc.landscapeGraph.nodes) {
    if (n.type === "alternative" && n.url) {
      lines.push(`  click ${n.id} "${safeHref(n.url)}" _blank`);
    }
  }
  for (const c of LANDSCAPE_CLASSDEF) lines.push(`  ${c}`);
  return lines.join("\n");
}
