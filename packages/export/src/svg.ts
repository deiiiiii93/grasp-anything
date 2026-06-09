import type { BriefDoc } from "@grasp/schema";
import { layoutLandscape } from "@grasp/dashboard/adapters";

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
