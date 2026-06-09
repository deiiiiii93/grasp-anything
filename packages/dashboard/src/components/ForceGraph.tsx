import { useEffect, useMemo, useRef, useState } from "react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCollide,
  type Simulation,
  type SimulationNodeDatum,
} from "d3-force";

export interface ForceGraphNode {
  id: string;
  x: number;
  y: number;
  label: string;
  color: string;
  radius: number;
}

export interface ForceGraphEdge {
  id: string;
  source: string;
  target: string;
  /** Relationship word shown on the edge when an endpoint is hovered/selected. */
  type: string;
}

interface SimNode extends SimulationNodeDatum {
  id: string;
}

interface Transform {
  k: number;
  x: number;
  y: number;
}

const MIN_K = 0.4;
const MAX_K = 4;

function truncate(label: string, max = 30): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

/**
 * Interactive force-directed renderer shared by the concept and landscape graphs.
 * Positions arrive already settled (deterministic, from the layout adapter) so the
 * first paint matches the exported SVG; a live simulation re-hydrates only to add
 * drag-spring. Idle = no ticking (keeps tests and the CPU quiet).
 */
export function ForceGraph({
  nodes,
  edges,
  width,
  height,
  selectedId,
  onSelect,
  pinnedId,
  ariaLabel,
  testIdPrefix,
}: {
  nodes: ForceGraphNode[];
  edges: ForceGraphEdge[];
  width: number;
  height: number;
  selectedId: string;
  onSelect: (id: string) => void;
  pinnedId?: string;
  ariaLabel: string;
  testIdPrefix: string;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const simRef = useRef<Simulation<SimNode, undefined> | null>(null);
  const simNodesRef = useRef<SimNode[]>([]);
  const dragRef = useRef<string | null>(null);
  const panRef = useRef<{ vx: number; vy: number; tx: number; ty: number } | null>(null);

  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(() =>
    Object.fromEntries(nodes.map((n) => [n.id, { x: n.x, y: n.y }])),
  );
  const [transform, setTransform] = useState<Transform>({ k: 1, x: 0, y: 0 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const transformRef = useRef(transform);
  transformRef.current = transform;

  // Adjacency for hover highlighting and edge-label gating.
  const neighbors = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const n of nodes) map.set(n.id, new Set());
    for (const e of edges) {
      map.get(e.source)?.add(e.target);
      map.get(e.target)?.add(e.source);
    }
    return map;
  }, [nodes, edges]);

  const nodesKey = nodes.map((n) => n.id).join(",");

  // (Re)build the live simulation when the node set changes. Starts stopped at
  // alpha 0; only a drag reheats it, so an untouched graph never ticks.
  useEffect(() => {
    const simNodes: SimNode[] = nodes.map((n) => ({ id: n.id, x: n.x, y: n.y }));
    if (pinnedId) {
      const p = simNodes.find((n) => n.id === pinnedId);
      if (p) {
        p.fx = p.x;
        p.fy = p.y;
      }
    }
    simNodesRef.current = simNodes;
    setPositions(Object.fromEntries(simNodes.map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }])));

    const links = edges.map((e) => ({ source: e.source, target: e.target }));
    const sim = forceSimulation<SimNode>(simNodes)
      .force(
        "link",
        forceLink<SimNode, { source: string; target: string }>(links)
          .id((d) => d.id)
          .distance(120)
          .strength(0.4),
      )
      .force("charge", forceManyBody<SimNode>().strength(-460))
      .force("collide", forceCollide<SimNode>().radius(34).iterations(2))
      .alpha(0)
      .stop();

    sim.on("tick", () => {
      setPositions(
        Object.fromEntries(simNodesRef.current.map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }])),
      );
    });
    simRef.current = sim;

    return () => {
      sim.on("tick", null);
      sim.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodesKey, width, height]);

  // Native, non-passive wheel listener so we can preventDefault page scroll and zoom toward the cursor.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const g = clientToGraph(svg, e.clientX, e.clientY, transformRef.current);
      if (!g) return;
      const t = transformRef.current;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const k = Math.max(MIN_K, Math.min(MAX_K, t.k * factor));
      setTransform({ k, x: t.x + (t.k - k) * g.x, y: t.y + (t.k - k) * g.y });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  const startDrag = (id: string, e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = id;
    const node = simNodesRef.current.find((n) => n.id === id);
    if (node) {
      node.fx = node.x;
      node.fy = node.y;
    }
  };

  const startPan = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const v = clientToViewBox(svg, e.clientX, e.clientY);
    if (!v) return;
    panRef.current = { vx: v.x, vy: v.y, tx: transform.x, ty: transform.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    if (dragRef.current) {
      const g = clientToGraph(svg, e.clientX, e.clientY, transformRef.current);
      const node = simNodesRef.current.find((n) => n.id === dragRef.current);
      if (g && node) {
        node.fx = g.x;
        node.fy = g.y;
        const sim = simRef.current;
        if (sim && sim.alpha() < 0.05) sim.alphaTarget(0.3).restart();
      }
    } else if (panRef.current) {
      const v = clientToViewBox(svg, e.clientX, e.clientY);
      if (v) {
        const p = panRef.current;
        setTransform((t) => ({ ...t, x: p.tx + (v.x - p.vx), y: p.ty + (v.y - p.vy) }));
      }
    }
  };

  const endPointer = () => {
    if (dragRef.current) {
      const node = simNodesRef.current.find((n) => n.id === dragRef.current);
      if (node && node.id !== pinnedId) {
        node.fx = null;
        node.fy = null;
      }
      simRef.current?.alphaTarget(0);
      dragRef.current = null;
    }
    panRef.current = null;
  };

  const isActive = (id: string) =>
    !hoveredId || id === hoveredId || neighbors.get(hoveredId)?.has(id);

  const edgeActive = (e: ForceGraphEdge) =>
    e.source === hoveredId ||
    e.target === hoveredId ||
    e.source === selectedId ||
    e.target === selectedId;

  const pos = (id: string) => positions[id] ?? { x: 0, y: 0 };

  return (
    <div className="graph-canvas">
      <svg
        ref={svgRef}
        className="graph-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-label={ariaLabel}
        onPointerDown={startPan}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerLeave={endPointer}
      >
        <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}>
          {edges.map((e) => {
            const s = pos(e.source);
            const t = pos(e.target);
            const active = edgeActive(e);
            const dim = hoveredId && !active;
            return (
              <g key={e.id}>
                <line
                  className={`graph-edge${active ? " active" : ""}${dim ? " dim" : ""}`}
                  x1={s.x}
                  y1={s.y}
                  x2={t.x}
                  y2={t.y}
                />
                {active && (
                  <text className="graph-edge-label" x={(s.x + t.x) / 2} y={(s.y + t.y) / 2}>
                    {e.type}
                  </text>
                )}
              </g>
            );
          })}
          {nodes.map((n) => {
            const p = pos(n.id);
            const active = isActive(n.id);
            return (
              <g
                key={n.id}
                data-testid={`${testIdPrefix}-node-${n.id}`}
                className={`graph-node${n.id === selectedId ? " selected" : ""}${
                  active ? "" : " dim"
                }`}
                transform={`translate(${p.x}, ${p.y})`}
                role="button"
                tabIndex={0}
                aria-label={n.label}
                aria-pressed={n.id === selectedId}
                onPointerDown={(e) => startDrag(n.id, e)}
                onClick={() => onSelect(n.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(n.id);
                  }
                }}
                onMouseEnter={() => setHoveredId(n.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <circle r={n.radius} fill={n.color} />
                <text className="graph-node-label" y={-n.radius - 8} textAnchor="middle">
                  {truncate(n.label)}
                </text>
                <title>{n.label}</title>
              </g>
            );
          })}
        </g>
      </svg>
      <div className="graph-controls">
        <button type="button" onClick={() => setTransform({ k: 1, x: 0, y: 0 })}>
          Reset view
        </button>
      </div>
    </div>
  );
}

/** Map a client (screen) point into the SVG's viewBox coordinate space. */
function clientToViewBox(svg: SVGSVGElement, clientX: number, clientY: number) {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const v = pt.matrixTransform(ctm.inverse());
  return { x: v.x, y: v.y };
}

/** Map a client point into graph coordinates, undoing the current zoom/pan transform. */
function clientToGraph(svg: SVGSVGElement, clientX: number, clientY: number, t: Transform) {
  const v = clientToViewBox(svg, clientX, clientY);
  if (!v) return null;
  return { x: (v.x - t.x) / t.k, y: (v.y - t.y) / t.k };
}
