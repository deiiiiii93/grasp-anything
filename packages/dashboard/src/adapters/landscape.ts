import type { BriefDoc, LandscapeNodeType } from "@grasp/schema";
import { resolveEvidence, type EvidenceChip } from "./brief";
import type { GraphEdgeVM } from "./concept";

export interface LandscapeNodeVM {
  id: string;
  kind: LandscapeNodeType;
  label: string;
  x: number;
  y: number;
  url?: string;
  stars?: number;
  similarity?: number;
  differentiator?: string;
  oneLiner?: string;
  categoryId?: string;
  color: string;
  evidence: EvidenceChip[];
}

export interface CategoryVM {
  id: string;
  label: string;
  color: string;
}

export interface LandscapeLayout {
  nodes: LandscapeNodeVM[];
  edges: GraphEdgeVM[];
  categories: CategoryVM[];
  width: number;
  height: number;
}

// Gold (#f5c451) is reserved for the self node, so it is intentionally absent here.
const CATEGORY_COLORS = ["#5aa9f0", "#5bd1a0", "#b794f6", "#e5687a"];
const SELF_COLOR = "#f5c451";
const DEFAULT_COLOR = "#9aa3b2";

export function layoutLandscape(doc: BriefDoc, width = 640, height = 480): LandscapeLayout {
  const cx = width / 2;
  const cy = height / 2;
  const minR = 70;
  const maxR = Math.min(width, height) / 2 - 60;

  const categories: CategoryVM[] = doc.landscapeGraph.nodes
    .filter((n) => n.type === "category")
    .map((c, i) => ({
      id: c.id,
      label: c.label ?? c.id,
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    }));
  const colorFor = (categoryId?: string) =>
    categories.find((c) => c.id === categoryId)?.color ?? DEFAULT_COLOR;

  const selfNode = doc.landscapeGraph.nodes.find((n) => n.type === "self")!;
  const alternatives = doc.landscapeGraph.nodes.filter((n) => n.type === "alternative");

  const nodes: LandscapeNodeVM[] = [
    {
      id: selfNode.id,
      kind: selfNode.type,
      label: selfNode.name ?? selfNode.label ?? selfNode.id,
      x: cx,
      y: cy,
      url: selfNode.url,
      stars: selfNode.stars,
      categoryId: selfNode.category,
      color: SELF_COLOR,
      evidence: resolveEvidence(doc, selfNode.evidenceIds),
    },
  ];

  const count = Math.max(alternatives.length, 1);
  alternatives.forEach((alt, i) => {
    const angle = -Math.PI / 2 + (i / count) * 2 * Math.PI;
    const similarity = alt.similarity ?? 0.5;
    const r = minR + (1 - similarity) * (maxR - minR);
    nodes.push({
      id: alt.id,
      kind: alt.type,
      label: alt.name ?? alt.label ?? alt.id,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      url: alt.url,
      stars: alt.stars,
      similarity: alt.similarity,
      differentiator: alt.differentiator,
      oneLiner: alt.oneLiner,
      categoryId: alt.category,
      color: colorFor(alt.category),
      evidence: resolveEvidence(doc, alt.evidenceIds),
    });
  });

  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges: GraphEdgeVM[] = doc.landscapeGraph.edges
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
    .map((e) => ({ id: e.id, source: e.source, target: e.target, type: e.type }));

  return { nodes, edges, categories, width, height };
}
