import type { BriefDoc, AtlasDomain, FlowEdgeType } from "@grasp/schema";
import { resolveEvidence, type EvidenceChip } from "./brief";

// Domain → real-world geography. The data stays geography-agnostic; this fixed
// table is the only place that knows about Earth. lat/lng are continent centroids.
export const CONTINENT_GEO: Record<AtlasDomain, { continentName: string; motif: string; lat: number; lng: number; color: string }> = {
  architecture:   { continentName: "Asia",          motif: "Great Wall",        lat: 45,  lng: 90,   color: "#e5687a" },
  modules:        { continentName: "Europe",        motif: "Eiffel Tower",      lat: 50,  lng: 15,   color: "#b794f6" },
  workflows:      { continentName: "North America", motif: "Statue of Liberty", lat: 45,  lng: -100, color: "#5aa9f0" },
  businessFlows:  { continentName: "Africa",        motif: "Pyramids",          lat: 2,   lng: 20,   color: "#f5c451" },
  techSelection:  { continentName: "South America", motif: "Machu Picchu",      lat: -15, lng: -60,  color: "#5bd1a0" },
  uiUxTaste:      { continentName: "Oceania",       motif: "Opera House",       lat: -25, lng: 135,  color: "#f0974a" },
};

// Domain → teaching metaphor. Like CONTINENT_GEO, narrative is a renderer-side
// skin: the analyzer stays story-agnostic. Each landmark motif carries a concept
// that frames its domain — the "Soaring Over the Horizon" script of the atlas.
export const DOMAIN_STORY: Record<AtlasDomain, { concept: string; lesson: string }> = {
  architecture: {
    concept: "Even the Great Wall starts with one brick.",
    lesson: "A system is laid brick by brick — see the layers before the bricks.",
  },
  modules: {
    concept: "18,038 prefabricated pieces, assembled on site — modular is the power.",
    lesson: "Independent parts with clean joints: swappable, repairable, replicable.",
  },
  workflows: {
    concept: "French design, American made — standard flows make things happen.",
    lesson: "A standardized handoff lets work cross any boundary: design in one place, assemble in another.",
  },
  businessFlows: {
    concept: "The oldest org chart in stone — business flow comes first.",
    lesson: "Hierarchy and the flow of value were designed before a single block moved.",
  },
  techSelection: {
    concept: "Ashlar and andenes — the best choice is the one that fits.",
    lesson: "Technique chosen to fit the mountain, not the fashion: selection is fit, not fame.",
  },
  uiUxTaste: {
    concept: "Beauty as productivity.",
    lesson: "A distinctive sensibility is a feature: taste compounds into adoption.",
  },
};

// Curated real-city anchors per continent (well inside the landmass). The Nth
// atlas city of a continent docks at the Nth anchor, so every concept-city gets
// a real name and a coastline-safe position — no more dots in the ocean.
export const ANCHOR_CITIES: Record<AtlasDomain, { name: string; lat: number; lng: number }[]> = {
  architecture: [
    { name: "Beijing", lat: 39.9, lng: 116.4 }, { name: "Tokyo", lat: 35.7, lng: 139.7 },
    { name: "Delhi", lat: 28.6, lng: 77.2 }, { name: "Seoul", lat: 37.6, lng: 127.0 },
    { name: "Bangkok", lat: 13.8, lng: 100.5 }, { name: "Xi'an", lat: 34.3, lng: 108.9 },
    { name: "Shanghai", lat: 31.2, lng: 121.5 }, { name: "Almaty", lat: 43.2, lng: 76.9 },
  ],
  modules: [
    { name: "Paris", lat: 48.9, lng: 2.35 }, { name: "Berlin", lat: 52.5, lng: 13.4 },
    { name: "Rome", lat: 41.9, lng: 12.5 }, { name: "Madrid", lat: 40.4, lng: -3.7 },
    { name: "Vienna", lat: 48.2, lng: 16.4 }, { name: "Prague", lat: 50.1, lng: 14.4 },
    { name: "Warsaw", lat: 52.2, lng: 21.0 }, { name: "Amsterdam", lat: 52.4, lng: 4.9 },
  ],
  workflows: [
    { name: "New York", lat: 40.7, lng: -74.0 }, { name: "San Francisco", lat: 37.8, lng: -122.4 },
    { name: "Chicago", lat: 41.9, lng: -87.6 }, { name: "Toronto", lat: 43.7, lng: -79.4 },
    { name: "Mexico City", lat: 19.4, lng: -99.1 }, { name: "Seattle", lat: 47.6, lng: -122.3 },
    { name: "Denver", lat: 39.7, lng: -105.0 }, { name: "Atlanta", lat: 33.7, lng: -84.4 },
  ],
  businessFlows: [
    { name: "Cairo", lat: 30.0, lng: 31.2 }, { name: "Nairobi", lat: -1.3, lng: 36.8 },
    { name: "Lagos", lat: 6.5, lng: 3.4 }, { name: "Johannesburg", lat: -26.2, lng: 28.0 },
    { name: "Addis Ababa", lat: 9.0, lng: 38.7 }, { name: "Casablanca", lat: 33.6, lng: -7.6 },
    { name: "Accra", lat: 5.6, lng: -0.2 }, { name: "Kinshasa", lat: -4.3, lng: 15.3 },
  ],
  // ASCII-only names: globe.gl renders labels with a typeface font that has no
  // diacritic glyphs ("São" would draw as "S?o").
  techSelection: [
    { name: "Cusco", lat: -13.5, lng: -72.0 }, { name: "Sao Paulo", lat: -23.6, lng: -46.6 },
    { name: "Bogota", lat: 4.7, lng: -74.1 }, { name: "Buenos Aires", lat: -34.6, lng: -58.4 },
    { name: "Santiago", lat: -33.4, lng: -70.7 }, { name: "Quito", lat: -0.2, lng: -78.5 },
    { name: "La Paz", lat: -16.5, lng: -68.1 }, { name: "Brasilia", lat: -15.8, lng: -47.9 },
  ],
  uiUxTaste: [
    { name: "Sydney", lat: -33.9, lng: 151.2 }, { name: "Melbourne", lat: -37.8, lng: 145.0 },
    { name: "Auckland", lat: -36.8, lng: 174.8 }, { name: "Brisbane", lat: -27.5, lng: 153.0 },
    { name: "Perth", lat: -31.9, lng: 115.9 }, { name: "Adelaide", lat: -34.9, lng: 138.6 },
    { name: "Canberra", lat: -35.3, lng: 149.1 }, { name: "Wellington", lat: -41.3, lng: 174.8 },
  ],
};

export interface ContinentView {
  id: string; domain: AtlasDomain; title: string; summary: string;
  continentName: string; motif: string; lat: number; lng: number; color: string;
  cityCount: number; landmarkCount: number; evidence: EvidenceChip[];
}
export interface CityView {
  id: string; continentId: string; domain: AtlasDomain; name: string; summary?: string;
  anchorName?: string; // the real city this concept-city docks at, e.g. "Cusco"
  lat: number; lng: number; color: string; evidence: EvidenceChip[];
}
export interface LandmarkView {
  id: string; cityId: string; continentId: string; domain: AtlasDomain; name: string;
  detail?: string; whyItMatters?: string; techTag?: string; tags: string[];
  lat: number; lng: number; color: string; evidence: EvidenceChip[];
}
export interface ArcView {
  id: string;
  continentId: string;
  // "flow" = an analyzer-emitted flow edge; "spoke" = the hierarchy link from a
  // city to one of its landmarks (drawn so the network is visible on the globe).
  kind: "flow" | "spoke";
  type?: FlowEdgeType; // flows only
  sourceId: string; targetId: string;
  sourceName: string; targetName: string;
  startLat: number; startLng: number;
  endLat: number; endLng: number;
  color: string;
  label?: string;
}
export interface OutlineNode {
  id: string; kind: "continent" | "city" | "landmark"; title: string;
  children: OutlineNode[];
}
export interface AtlasView {
  continents: ContinentView[];
  cities: CityView[];
  landmarks: LandmarkView[];
  arcs: ArcView[];
  outline: OutlineNode[];
}

// Deterministic hash → [0,1). Pure function of the id string only.
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}
// Seeded ring offset around a centroid (degrees). Index spreads points by angle;
// `spread` bounds the extra seeded radius so satellites stay near their parent.
function ringPoint(centroid: { lat: number; lng: number }, id: string, index: number, ring: number, spread = 6) {
  const angle = (index * 137.5 + hash01(id) * 360) * (Math.PI / 180);
  const r = ring + hash01(id + "r") * spread;
  return { lat: centroid.lat + r * Math.sin(angle), lng: centroid.lng + r * Math.cos(angle) };
}

export function buildAtlasView(doc: BriefDoc): AtlasView {
  const continents: ContinentView[] = [];
  const cities: CityView[] = [];
  const landmarks: LandmarkView[] = [];
  const arcs: ArcView[] = [];
  const outline: OutlineNode[] = [];

  for (const cont of doc.atlas.continents) {
    const geo = CONTINENT_GEO[cont.domain];
    const centroid = { lat: geo.lat, lng: geo.lng };
    let landmarkCount = 0;
    const contOutline: OutlineNode = { id: cont.id, kind: "continent", title: cont.title, children: [] };

    const anchors = ANCHOR_CITIES[cont.domain];
    cont.cities.forEach((city, ci) => {
      // Dock at the next real anchor city; overflow falls back to the seeded ring.
      const anchor = anchors[ci];
      const cp = anchor ? { lat: anchor.lat, lng: anchor.lng } : ringPoint(centroid, city.id, ci, 10, 4);
      cities.push({ id: city.id, continentId: cont.id, domain: cont.domain, name: city.name, summary: city.summary, anchorName: anchor?.name, lat: cp.lat, lng: cp.lng, color: geo.color, evidence: resolveEvidence(doc, city.evidenceIds) });
      const cityOutline: OutlineNode = {
        id: city.id, kind: "city",
        title: anchor ? `${city.name} · ${anchor.name}` : city.name,
        children: [],
      };
      city.landmarks.forEach((lm, li) => {
        // Landmarks huddle 1.6–3° around their city so they stay on the landmass.
        const lp = ringPoint(cp, lm.id, li, 1.6, 1.4);
        landmarks.push({ id: lm.id, cityId: city.id, continentId: cont.id, domain: cont.domain, name: lm.name, detail: lm.detail, whyItMatters: lm.whyItMatters, techTag: lm.techTag, tags: lm.tags, lat: lp.lat, lng: lp.lng, color: geo.color, evidence: resolveEvidence(doc, lm.evidenceIds) });
        cityOutline.children.push({ id: lm.id, kind: "landmark", title: lm.name, children: [] });
        // The hierarchy made visible: a spoke from the city to each landmark.
        arcs.push({
          id: `spoke_${lm.id}`, continentId: cont.id, kind: "spoke",
          sourceId: city.id, targetId: lm.id, sourceName: city.name, targetName: lm.name,
          startLat: cp.lat, startLng: cp.lng, endLat: lp.lat, endLng: lp.lng, color: geo.color,
        });
        landmarkCount += 1;
      });
      contOutline.children.push(cityOutline);
    });

    // Resolve this continent's flows into great-circle arcs. Endpoints are city or
    // landmark ids within THIS continent (guaranteed by validateBrief; skip if missing).
    const posById = new Map<string, { lat: number; lng: number; name: string }>();
    for (const c of cities) if (c.continentId === cont.id) posById.set(c.id, { lat: c.lat, lng: c.lng, name: c.name });
    for (const l of landmarks) if (l.continentId === cont.id) posById.set(l.id, { lat: l.lat, lng: l.lng, name: l.name });
    for (const fl of cont.flows) {
      const s = posById.get(fl.source);
      const t = posById.get(fl.target);
      if (!s || !t) continue;
      arcs.push({
        id: fl.id, continentId: cont.id, kind: "flow", type: fl.type, label: fl.label,
        sourceId: fl.source, targetId: fl.target, sourceName: s.name, targetName: t.name,
        startLat: s.lat, startLng: s.lng, endLat: t.lat, endLng: t.lng, color: geo.color,
      });
    }

    continents.push({ id: cont.id, domain: cont.domain, title: cont.title, summary: cont.summary, continentName: geo.continentName, motif: geo.motif, lat: geo.lat, lng: geo.lng, color: geo.color, cityCount: cont.cities.length, landmarkCount, evidence: resolveEvidence(doc, cont.evidenceIds) });
    outline.push(contOutline);
  }

  return { continents, cities, landmarks, arcs, outline };
}

export interface SelectionContext {
  level: 1 | 2 | 3 | 4;
  continentId: string | null;
  cityId: string | null;
  landmarkId: string | null;
  lat: number | null; lng: number | null; // camera target (selected node's position)
}

export function selectionContext(view: AtlasView, selectedId: string | null): SelectionContext {
  const base = { continentId: null, cityId: null, landmarkId: null, lat: null, lng: null };
  if (!selectedId) return { level: 1, ...base };
  const lm = view.landmarks.find((l) => l.id === selectedId);
  if (lm) return { level: 4, continentId: lm.continentId, cityId: lm.cityId, landmarkId: lm.id, lat: lm.lat, lng: lm.lng };
  const city = view.cities.find((c) => c.id === selectedId);
  if (city) return { level: 3, continentId: city.continentId, cityId: city.id, landmarkId: null, lat: city.lat, lng: city.lng };
  const cont = view.continents.find((c) => c.id === selectedId);
  if (cont) return { level: 2, continentId: cont.id, cityId: null, landmarkId: null, lat: cont.lat, lng: cont.lng };
  return { level: 1, ...base };
}

// Flows touching a selection: the flow arcs (spokes are structure, not flows)
// whose endpoints include the selected city/landmark, or every flow of a
// selected continent.
export function relatedFlows(view: AtlasView, selectedId: string | null): ArcView[] {
  if (!selectedId) return [];
  const flows = view.arcs.filter((a) => a.kind === "flow");
  if (view.continents.some((c) => c.id === selectedId))
    return flows.filter((a) => a.continentId === selectedId);
  return flows.filter((a) => a.sourceId === selectedId || a.targetId === selectedId);
}

export interface SearchHit {
  id: string;
  kind: "continent" | "city" | "landmark";
  title: string;
  context: string; // breadcrumb-ish: continent (· city) the hit lives in
}

// Case-insensitive search over names, techTags, and tags. Pure; UI-agnostic.
export function searchAtlas(view: AtlasView, query: string): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: SearchHit[] = [];
  const contById = new Map(view.continents.map((c) => [c.id, c]));
  const cityById = new Map(view.cities.map((c) => [c.id, c]));
  for (const c of view.continents) {
    if (c.title.toLowerCase().includes(q)) hits.push({ id: c.id, kind: "continent", title: c.title, context: c.continentName });
  }
  for (const c of view.cities) {
    if (`${c.name} ${c.anchorName ?? ""}`.toLowerCase().includes(q))
      hits.push({ id: c.id, kind: "city", title: c.anchorName ? `${c.name} · ${c.anchorName}` : c.name, context: contById.get(c.continentId)?.title ?? "" });
  }
  for (const l of view.landmarks) {
    const hay = [l.name, l.techTag ?? "", ...l.tags].join(" ").toLowerCase();
    if (hay.includes(q)) {
      const cont = contById.get(l.continentId)?.title ?? "";
      const city = cityById.get(l.cityId)?.name ?? "";
      hits.push({ id: l.id, kind: "landmark", title: l.name, context: `${cont} · ${city}` });
    }
  }
  return hits;
}

// Level-of-detail gate. Cities appear at Continent altitude (2+); landmarks and
// flow arcs at City altitude (3+).
export function visibleAt(kind: "city" | "landmark" | "arc", level: 1 | 2 | 3 | 4): boolean {
  if (kind === "city") return level >= 2;
  return level >= 3; // landmark, arc
}
