import type { BriefDoc, ConceptNodeType } from "@grasp/schema";
import { resolveEvidence, type EvidenceChip } from "./brief";
import { forceLayout, estimateLabelWidth, type ForceNodeInput } from "./force";

export interface GraphEdgeVM {
  id: string;
  source: string;
  target: string;
  type: string;
}

export interface ConceptNodeVM {
  id: string;
  type: ConceptNodeType;
  label: string;
  detail: string;
  x: number;
  y: number;
  evidence: EvidenceChip[];
}

export interface ConceptLayout {
  nodes: ConceptNodeVM[];
  edges: GraphEdgeVM[];
  width: number;
  height: number;
}

// Ring placement order for non-idea nodes (problem opposite the mechanisms, etc.).
const TYPE_ORDER: ConceptNodeType[] = ["problem", "mechanism", "outcome", "feature"];

export const IDEA_RADIUS = 22;
export const NODE_RADIUS = 14;

export function layoutConcept(doc: BriefDoc, width = 640, height = 480): ConceptLayout {
  const ideaNode = doc.conceptGraph.nodes.find((n) => n.type === "idea")!;
  const others = doc.conceptGraph.nodes
    .filter((n) => n.type !== "idea")
    .map((n, i) => ({ n, i }))
    .sort((a, b) => TYPE_ORDER.indexOf(a.n.type) - TYPE_ORDER.indexOf(b.n.type) || a.i - b.i)
    .map(({ n }) => n);

  // Idea is the pinned root; everything else settles organically around it.
  const ordered = [ideaNode, ...others];
  const forceInputs: ForceNodeInput[] = ordered.map((n) => ({
    id: n.id,
    radius: n.type === "idea" ? IDEA_RADIUS : NODE_RADIUS,
    labelWidth: estimateLabelWidth(n.label),
    pinned: n.type === "idea",
  }));
  const pos = forceLayout(forceInputs, doc.conceptGraph.edges, width, height);

  const nodes: ConceptNodeVM[] = ordered.map((n) => ({
    id: n.id,
    type: n.type,
    label: n.label,
    detail: n.detail,
    x: pos.get(n.id)!.x,
    y: pos.get(n.id)!.y,
    evidence: resolveEvidence(doc, n.evidenceIds),
  }));

  const edges: GraphEdgeVM[] = doc.conceptGraph.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: e.type,
  }));

  return { nodes, edges, width, height };
}
