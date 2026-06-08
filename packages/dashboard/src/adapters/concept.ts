import type { BriefDoc, ConceptNodeType } from "@grasp/schema";
import { resolveEvidence, type EvidenceChip } from "./brief";

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

export function layoutConcept(doc: BriefDoc, width = 640, height = 480): ConceptLayout {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) / 2 - 60;

  const ideaNode = doc.conceptGraph.nodes.find((n) => n.type === "idea")!;
  const others = doc.conceptGraph.nodes
    .filter((n) => n.type !== "idea")
    .map((n, i) => ({ n, i }))
    .sort((a, b) => TYPE_ORDER.indexOf(a.n.type) - TYPE_ORDER.indexOf(b.n.type) || a.i - b.i)
    .map(({ n }) => n);

  const nodes: ConceptNodeVM[] = [
    {
      id: ideaNode.id,
      type: ideaNode.type,
      label: ideaNode.label,
      detail: ideaNode.detail,
      x: cx,
      y: cy,
      evidence: resolveEvidence(doc, ideaNode.evidenceIds),
    },
  ];

  const count = Math.max(others.length, 1);
  others.forEach((node, i) => {
    const angle = -Math.PI / 2 + (i / count) * 2 * Math.PI;
    nodes.push({
      id: node.id,
      type: node.type,
      label: node.label,
      detail: node.detail,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      evidence: resolveEvidence(doc, node.evidenceIds),
    });
  });

  const edges: GraphEdgeVM[] = doc.conceptGraph.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: e.type,
  }));

  return { nodes, edges, width, height };
}
