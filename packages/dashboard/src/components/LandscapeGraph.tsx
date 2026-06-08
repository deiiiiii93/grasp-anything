import { useState } from "react";
import type { BriefDoc } from "@grasp/schema";
import { layoutLandscape } from "../adapters/landscape";
import { EvidenceChips } from "./EvidenceChips";

export function LandscapeGraph({ doc }: { doc: BriefDoc }) {
  const layout = layoutLandscape(doc);
  const self = layout.nodes.find((n) => n.kind === "self")!;
  const [selectedId, setSelectedId] = useState<string>(self.id);
  const selected = layout.nodes.find((n) => n.id === selectedId) ?? self;
  const byId = new Map(layout.nodes.map((n) => [n.id, n]));

  return (
    <div className="graph-view" data-testid="landscape-graph">
      <svg
        className="graph-svg"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="group"
        aria-label="Competitive landscape"
      >
        {layout.edges.map((e) => {
          const s = byId.get(e.source);
          const t = byId.get(e.target);
          if (!s || !t) return null;
          return <line key={e.id} className="graph-edge" x1={s.x} y1={s.y} x2={t.x} y2={t.y} />;
        })}
        {layout.nodes.map((n) => {
          const radius = n.kind === "self" ? 22 : 14;
          return (
            <g
              key={n.id}
              data-testid={`landscape-node-${n.id}`}
              className={`graph-node${n.id === selectedId ? " selected" : ""}`}
              transform={`translate(${n.x}, ${n.y})`}
              role="button"
              tabIndex={0}
              aria-label={n.label}
              aria-pressed={n.id === selectedId}
              onClick={() => setSelectedId(n.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedId(n.id);
                }
              }}
            >
              <circle r={radius} fill={n.color} />
              <text className="graph-node-label" y={-radius - 8} textAnchor="middle">
                {n.label}
              </text>
            </g>
          );
        })}
      </svg>
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
