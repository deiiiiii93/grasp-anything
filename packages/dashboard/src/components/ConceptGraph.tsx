import { useState } from "react";
import type { BriefDoc } from "@grasp/schema";
import { layoutConcept, IDEA_RADIUS, NODE_RADIUS } from "../adapters/concept";
import { ForceGraph, type ForceGraphNode } from "./ForceGraph";
import { EvidenceChips } from "./EvidenceChips";

const TYPE_COLORS: Record<string, string> = {
  problem: "var(--problem)",
  idea: "var(--idea)",
  mechanism: "var(--how)",
  outcome: "var(--why)",
  feature: "var(--takeaway)",
};

export function ConceptGraph({ doc }: { doc: BriefDoc }) {
  const layout = layoutConcept(doc);
  const idea = layout.nodes.find((n) => n.type === "idea")!;
  const [selectedId, setSelectedId] = useState<string>(idea.id);
  const selected = layout.nodes.find((n) => n.id === selectedId) ?? idea;

  const fgNodes: ForceGraphNode[] = layout.nodes.map((n) => ({
    id: n.id,
    x: n.x,
    y: n.y,
    label: n.label,
    color: TYPE_COLORS[n.type] ?? "var(--muted)",
    radius: n.type === "idea" ? IDEA_RADIUS : NODE_RADIUS,
  }));

  return (
    <div className="graph-view" data-testid="concept-graph">
      <ForceGraph
        nodes={fgNodes}
        edges={layout.edges}
        width={layout.width}
        height={layout.height}
        selectedId={selectedId}
        onSelect={setSelectedId}
        pinnedId={idea.id}
        ariaLabel="Concept map"
        testIdPrefix="concept"
      />
      <aside className="graph-detail" data-testid="concept-detail">
        <span className="graph-detail-type">{selected.type}</span>
        <h3>{selected.label}</h3>
        {selected.detail && <p>{selected.detail}</p>}
        <EvidenceChips evidence={selected.evidence} />
      </aside>
    </div>
  );
}
