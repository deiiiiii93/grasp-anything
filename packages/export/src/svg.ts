import type { BriefDoc } from "@grasp/schema";
import { layoutConcept, layoutLandscape } from "@grasp/dashboard/adapters";

const CONCEPT_FILL: Record<string, string> = {
  idea: "#f5c451",
  problem: "#e5687a",
  mechanism: "#5aa9f0",
  outcome: "#5bd1a0",
  feature: "#b794f6",
};
const DEFAULT_FILL = "#9aa3b2";

function xml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface RenderNode {
  id: string;
  x: number;
  y: number;
  label: string;
  fill: string;
}

function renderSvg(
  cls: string,
  width: number,
  height: number,
  nodes: RenderNode[],
  edges: { source: string; target: string }[],
): string {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const parts = [
    `<svg class="graph ${cls}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`,
  ];
  for (const e of edges) {
    const s = byId.get(e.source);
    const t = byId.get(e.target);
    if (!s || !t) continue;
    parts.push(`<line class="edge" x1="${s.x}" y1="${s.y}" x2="${t.x}" y2="${t.y}"/>`);
  }
  for (const n of nodes) {
    parts.push(
      `<g transform="translate(${n.x}, ${n.y})"><circle r="14" fill="${n.fill}"/>` +
        `<text y="-20" text-anchor="middle">${xml(n.label)}</text></g>`,
    );
  }
  parts.push("</svg>");
  return parts.join("");
}

export function conceptToSvg(doc: BriefDoc): string {
  const layout = layoutConcept(doc);
  const nodes: RenderNode[] = layout.nodes.map((n) => ({
    id: n.id,
    x: n.x,
    y: n.y,
    label: n.label,
    fill: CONCEPT_FILL[n.type] ?? DEFAULT_FILL,
  }));
  return renderSvg("concept", layout.width, layout.height, nodes, layout.edges);
}

export function landscapeToSvg(doc: BriefDoc): string {
  const layout = layoutLandscape(doc);
  const nodes: RenderNode[] = layout.nodes.map((n) => ({
    id: n.id,
    x: n.x,
    y: n.y,
    label: n.label,
    fill: n.color,
  }));
  return renderSvg("landscape", layout.width, layout.height, nodes, layout.edges);
}
