import type { BriefDoc, LandscapeNodeType } from "@grasp/schema";
import { resolveEvidence, type EvidenceChip } from "./brief";
import type { GraphEdgeVM } from "./concept";
import { forceLayout, estimateLabelWidth, type ForceNodeInput } from "./force";

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

export const SELF_RADIUS = 22;
export const ALT_RADIUS = 14;

export function layoutLandscape(doc: BriefDoc, width = 640, height = 480): LandscapeLayout {
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

  // Map similarity → ring distance: a more similar alternative sits closer to self.
  const ringRadius = (similarity: number | undefined) =>
    minR + (1 - (similarity ?? 0.5)) * (maxR - minR);

  const ordered = [selfNode, ...alternatives];
  const forceInputs: ForceNodeInput[] = ordered.map((n) =>
    n.type === "self"
      ? { id: n.id, radius: SELF_RADIUS, labelWidth: estimateLabelWidth(n.name ?? n.label ?? n.id), pinned: true }
      : {
          id: n.id,
          radius: ALT_RADIUS,
          labelWidth: estimateLabelWidth(n.name ?? n.label ?? n.id),
          targetRadius: ringRadius(n.similarity),
        },
  );
  const pos = forceLayout(forceInputs, doc.landscapeGraph.edges, width, height);

  const nodes: LandscapeNodeVM[] = [
    {
      id: selfNode.id,
      kind: selfNode.type,
      label: selfNode.name ?? selfNode.label ?? selfNode.id,
      x: pos.get(selfNode.id)!.x,
      y: pos.get(selfNode.id)!.y,
      url: selfNode.url,
      stars: selfNode.stars,
      categoryId: selfNode.category,
      color: SELF_COLOR,
      evidence: resolveEvidence(doc, selfNode.evidenceIds),
    },
    ...alternatives.map((alt) => ({
      id: alt.id,
      kind: alt.type,
      label: alt.name ?? alt.label ?? alt.id,
      x: pos.get(alt.id)!.x,
      y: pos.get(alt.id)!.y,
      url: alt.url,
      stars: alt.stars,
      similarity: alt.similarity,
      differentiator: alt.differentiator,
      oneLiner: alt.oneLiner,
      categoryId: alt.category,
      color: colorFor(alt.category),
      evidence: resolveEvidence(doc, alt.evidenceIds),
    })),
  ];

  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges: GraphEdgeVM[] = doc.landscapeGraph.edges
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
    .map((e) => ({ id: e.id, source: e.source, target: e.target, type: e.type }));

  return { nodes, edges, categories, width, height };
}
