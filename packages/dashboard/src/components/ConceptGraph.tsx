import { useState } from "react";
import type { BriefDoc } from "@grasp/schema";
import { layoutConcept } from "../adapters/concept";
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
  const byId = new Map(layout.nodes.map((n) => [n.id, n]));

  return (
    <div className="graph-view" data-testid="concept-graph">
      <svg
        className="graph-svg"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="img"
        aria-label="Concept map"
      >
        {layout.edges.map((e) => {
          const s = byId.get(e.source);
          const t = byId.get(e.target);
          if (!s || !t) return null;
          return <line key={e.id} className="graph-edge" x1={s.x} y1={s.y} x2={t.x} y2={t.y} />;
        })}
        {layout.nodes.map((n) => (
          <g
            key={n.id}
            data-testid={`concept-node-${n.id}`}
            className={`graph-node${n.id === selectedId ? " selected" : ""}`}
            transform={`translate(${n.x}, ${n.y})`}
            onClick={() => setSelectedId(n.id)}
          >
            <circle r={n.type === "idea" ? 22 : 14} fill={TYPE_COLORS[n.type] ?? "var(--muted)"} />
            <text className="graph-node-label" y={-22} textAnchor="middle">
              {n.label}
            </text>
          </g>
        ))}
      </svg>
      <aside className="graph-detail" data-testid="concept-detail">
        <span className="graph-detail-type">{selected.type}</span>
        <h3>{selected.label}</h3>
        {selected.detail && <p>{selected.detail}</p>}
        <EvidenceChips evidence={selected.evidence} />
      </aside>
    </div>
  );
}
