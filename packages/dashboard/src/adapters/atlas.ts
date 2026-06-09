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

export interface ContinentView {
  id: string; domain: AtlasDomain; title: string; summary: string;
  continentName: string; motif: string; lat: number; lng: number; color: string;
  cityCount: number; landmarkCount: number; evidence: EvidenceChip[];
}
export interface CityView {
  id: string; continentId: string; name: string; summary?: string;
  lat: number; lng: number; color: string; evidence: EvidenceChip[];
}
export interface LandmarkView {
  id: string; cityId: string; continentId: string; name: string;
  detail?: string; whyItMatters?: string; techTag?: string; tags: string[];
  lat: number; lng: number; color: string; evidence: EvidenceChip[];
}
export interface ArcView {
  id: string;
  continentId: string;
  type: FlowEdgeType;
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
// Seeded ring offset around a centroid (degrees). Index spreads points by angle.
function ringPoint(centroid: { lat: number; lng: number }, id: string, index: number, ring: number) {
  const angle = (index * 137.5 + hash01(id) * 360) * (Math.PI / 180);
  const r = ring + hash01(id + "r") * 6;
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

    cont.cities.forEach((city, ci) => {
      const cp = ringPoint(centroid, city.id, ci, 14);
      cities.push({ id: city.id, continentId: cont.id, name: city.name, summary: city.summary, lat: cp.lat, lng: cp.lng, color: geo.color, evidence: resolveEvidence(doc, city.evidenceIds) });
      const cityOutline: OutlineNode = { id: city.id, kind: "city", title: city.name, children: [] };
      city.landmarks.forEach((lm, li) => {
        const lp = ringPoint(cp, lm.id, li, 6);
        landmarks.push({ id: lm.id, cityId: city.id, continentId: cont.id, name: lm.name, detail: lm.detail, whyItMatters: lm.whyItMatters, techTag: lm.techTag, tags: lm.tags, lat: lp.lat, lng: lp.lng, color: geo.color, evidence: resolveEvidence(doc, lm.evidenceIds) });
        cityOutline.children.push({ id: lm.id, kind: "landmark", title: lm.name, children: [] });
        landmarkCount += 1;
      });
      contOutline.children.push(cityOutline);
    });

    // Resolve this continent's flows into great-circle arcs. Endpoints are city or
    // landmark ids within THIS continent (guaranteed by validateBrief; skip if missing).
    const posById = new Map<string, { lat: number; lng: number }>();
    for (const c of cities) if (c.continentId === cont.id) posById.set(c.id, { lat: c.lat, lng: c.lng });
    for (const l of landmarks) if (l.continentId === cont.id) posById.set(l.id, { lat: l.lat, lng: l.lng });
    for (const fl of cont.flows) {
      const s = posById.get(fl.source);
      const t = posById.get(fl.target);
      if (!s || !t) continue;
      arcs.push({
        id: fl.id, continentId: cont.id, type: fl.type, label: fl.label,
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

// Level-of-detail gate. Cities appear at Continent altitude (2+); landmarks and
// flow arcs at City altitude (3+).
export function visibleAt(kind: "city" | "landmark" | "arc", level: 1 | 2 | 3 | 4): boolean {
  if (kind === "city") return level >= 2;
  return level >= 3; // landmark, arc
}
