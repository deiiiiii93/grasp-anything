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

export function conceptToMermaid(doc: BriefDoc): string {
  const lines = ["flowchart TD"];
  for (const n of doc.conceptGraph.nodes) {
    lines.push(`  ${nodeId(n.id)}["${label(n.label)}"]:::${n.type}`);
  }
  for (const e of doc.conceptGraph.edges) {
    lines.push(`  ${nodeId(e.source)} -->|${e.type}| ${nodeId(e.target)}`);
  }
  for (const c of CONCEPT_CLASSDEF) lines.push(`  ${c}`);
  return lines.join("\n");
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
