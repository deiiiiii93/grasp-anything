import { useState } from "react";
import type { BriefDoc } from "@grasp/schema";
import { layoutLandscape, SELF_RADIUS, ALT_RADIUS } from "../adapters/landscape";
import { ForceGraph, type ForceGraphNode } from "./ForceGraph";
import { EvidenceChips } from "./EvidenceChips";

export function LandscapeGraph({ doc }: { doc: BriefDoc }) {
  const layout = layoutLandscape(doc);
  const self = layout.nodes.find((n) => n.kind === "self")!;
  const [selectedId, setSelectedId] = useState<string>(self.id);
  const selected = layout.nodes.find((n) => n.id === selectedId) ?? self;

  const fgNodes: ForceGraphNode[] = layout.nodes.map((n) => ({
    id: n.id,
    x: n.x,
    y: n.y,
    label: n.label,
    color: n.color,
    radius: n.kind === "self" ? SELF_RADIUS : ALT_RADIUS,
  }));

  return (
    <div className="graph-view" data-testid="landscape-graph">
      <ForceGraph
        nodes={fgNodes}
        edges={layout.edges}
        width={layout.width}
        height={layout.height}
        selectedId={selectedId}
        onSelect={setSelectedId}
        pinnedId={self.id}
        ariaLabel="Competitive landscape"
        testIdPrefix="landscape"
      />
      <aside className="graph-detail" data-testid="landscape-detail">
        <h3>{selected.label}</h3>
        {selected.oneLiner && <p>{selected.oneLiner}</p>}
        {selected.differentiator && (
          <p className="differentiator">
            <strong>Differs:</strong> {selected.differentiator}
          </p>
        )}
        <ul className="graph-detail-meta">
          {selected.stars !== undefined && <li>★ {selected.stars.toLocaleString("en-US")}</li>}
          {selected.similarity !== undefined && <li>similarity {Math.round(selected.similarity * 100)}%</li>}
        </ul>
        <EvidenceChips evidence={selected.evidence} />
        {selected.kind === "alternative" && selected.url && (
          <a className="graph-detail-link" href={selected.url} target="_blank" rel="noreferrer">
            View on GitHub →
          </a>
        )}
      </aside>
      {layout.categories.length > 0 && (
        <ul className="graph-legend" data-testid="landscape-legend">
          {layout.categories.map((c) => (
            <li key={c.id}>
              <span className="legend-swatch" style={{ background: c.color }} /> {c.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
