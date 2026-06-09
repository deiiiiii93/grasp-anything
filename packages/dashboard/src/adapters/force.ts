import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCollide,
  forceX,
  forceY,
  forceRadial,
  type SimulationNodeDatum,
} from "d3-force";

/**
 * One node fed to the layout. `pinned` anchors a node at the canvas center (used
 * for the concept "idea" root and the landscape "self" node, so the layout reads
 * as radiating from the subject). `targetRadius` opts a node into a radial pull
 * toward a ring at that distance from center (landscape similarity bands); when
 * no node sets it, the layout is a free organic force graph (concept map).
 */
export interface ForceNodeInput {
  id: string;
  /** Circle radius in px — feeds the collision force so big nodes claim more room. */
  radius?: number;
  /** Approx label width in px — collision keeps labels from overlapping. */
  labelWidth?: number;
  /** Anchor this node at the exact center. */
  pinned?: boolean;
  /** Pull this node toward a ring this far from center (px). */
  targetRadius?: number;
}

export interface ForceLinkInput {
  source: string;
  target: string;
}

export interface Point {
  x: number;
  y: number;
}

interface SimNode extends SimulationNodeDatum {
  id: string;
  radius: number;
  labelWidth: number;
  targetRadius?: number;
}

// Deterministic PRNG (mulberry32). d3-force routes all randomness through the
// simulation's randomSource, so seeding it makes every run byte-identical — which
// is what lets the Node-side export and the in-browser dashboard agree, and what
// the determinism tests assert.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 0x9e3779b9;
const TICKS = 400;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Run a fixed, seeded force simulation to convergence and return final positions
 * keyed by node id. Pure and deterministic: no timers, no animation — `.stop()`
 * plus manual ticks. The live dashboard re-hydrates a simulation from these
 * positions to add drag/spring; the export serializes them straight to SVG.
 */
export function forceLayout(
  inputs: ForceNodeInput[],
  links: ForceLinkInput[],
  width: number,
  height: number,
): Map<string, Point> {
  const cx = width / 2;
  const cy = height / 2;
  const hasRadial = inputs.some((d) => d.targetRadius !== undefined);

  // Deterministic seed positions: a ring by index so nothing starts coincident.
  const nodes: SimNode[] = inputs.map((d, i) => {
    const angle = -Math.PI / 2 + (i / Math.max(inputs.length, 1)) * 2 * Math.PI;
    const seedR = d.pinned ? 0 : 90;
    const node: SimNode = {
      id: d.id,
      radius: d.radius ?? 14,
      labelWidth: d.labelWidth ?? 60,
      targetRadius: d.targetRadius,
      x: cx + seedR * Math.cos(angle),
      y: cy + seedR * Math.sin(angle),
    };
    if (d.pinned) {
      node.fx = cx;
      node.fy = cy;
    }
    return node;
  });

  const ids = new Set(nodes.map((n) => n.id));
  const linkData = links
    .filter((l) => ids.has(l.source) && ids.has(l.target))
    .map((l) => ({ source: l.source, target: l.target }));

  const sim = forceSimulation<SimNode>(nodes)
    .randomSource(mulberry32(SEED))
    .force(
      "link",
      forceLink<SimNode, { source: string; target: string }>(linkData)
        .id((d) => d.id)
        .distance(hasRadial ? 90 : 120)
        .strength(hasRadial ? 0.2 : 0.45),
    )
    .force("charge", forceManyBody<SimNode>().strength(hasRadial ? -260 : -520))
    .force(
      "collide",
      forceCollide<SimNode>()
        .radius((d) => Math.max(d.radius + 10, d.labelWidth / 2 + 8))
        .iterations(4),
    )
    .force("x", forceX<SimNode>(cx).strength(hasRadial ? 0.02 : 0.06))
    .force("y", forceY<SimNode>(cy).strength(hasRadial ? 0.02 : 0.08))
    .stop();

  if (hasRadial) {
    sim.force(
      "radial",
      forceRadial<SimNode>((d) => d.targetRadius ?? 0, cx, cy).strength((d) =>
        d.targetRadius !== undefined ? 0.9 : 0,
      ),
    );
  }

  for (let i = 0; i < TICKS; i++) sim.tick();
  sim.stop();

  const pad = 36;
  const out = new Map<string, Point>();
  for (const n of nodes) {
    out.set(n.id, {
      x: round(clamp(n.x ?? cx, pad, width - pad)),
      y: round(clamp(n.y ?? cy, pad, height - pad)),
    });
  }
  return out;
}

/** Rough label width estimate (px) for collision sizing, capped so long labels don't blow up spacing. */
export function estimateLabelWidth(label: string, charPx = 6.2, max = 180): number {
  return Math.min(label.length * charPx, max);
}
