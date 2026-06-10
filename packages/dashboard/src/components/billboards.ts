import type { AtlasView, SelectionContext } from "../adapters/atlas";
import { visibleAt } from "../adapters/atlas";

export type BillboardTier = "continent" | "city" | "landmark";

// One positioned marker on the globe overlay. Pure data: the rAF loop and CSS
// decide pixels; this module decides WHAT is visible and WHICH sprite it wears.
export interface Billboard {
  id: string;
  tier: BillboardTier;
  lat: number;
  lng: number;
  spriteUrl: string;
  label: string;
  color: string;
  /** landmark's index within its city (drives the label stagger); 0 elsewhere */
  staggerIndex: number;
  title: string; // hover text
}

// Deterministic label collision-avoidance: alternate above/below the pin and
// widen every pair: -12, +12, -20, +20, ...
export function staggerOffsetPx(b: Pick<Billboard, "tier" | "staggerIndex">): number {
  if (b.tier !== "landmark") return 0;
  const i = b.staggerIndex;
  return (i % 2 === 0 ? -1 : 1) * (12 + 8 * Math.floor(i / 2));
}

// Same LOD + focus-filter rules the labelsData path used: cities appear at
// Continent altitude (focused continent only once dived), landmarks at City
// altitude (focused city only).
export function buildBillboards(view: AtlasView, ctx: SelectionContext): Billboard[] {
  const continents: Billboard[] = view.continents.map((c) => ({
    id: c.id, tier: "continent", lat: c.lat, lng: c.lng,
    spriteUrl: `./atlas/landmarks/${c.domain}.png`,
    label: c.title, color: c.color, staggerIndex: 0, title: c.title,
  }));
  const cities: Billboard[] = (visibleAt("city", ctx.level)
    ? view.cities.filter((c) => !ctx.continentId || c.continentId === ctx.continentId)
    : []
  ).map((c) => ({
    id: c.id, tier: "city", lat: c.lat, lng: c.lng,
    spriteUrl: `./atlas/cities/${c.domain}.png`,
    label: c.anchorName ? `${c.name} · ${c.anchorName}` : c.name,
    color: c.color, staggerIndex: 0, title: c.summary || c.name,
  }));
  const perCity = new Map<string, number>();
  const landmarks: Billboard[] = (visibleAt("landmark", ctx.level)
    ? view.landmarks.filter((l) => !ctx.cityId || l.cityId === ctx.cityId)
    : []
  ).map((l) => {
    const i = perCity.get(l.cityId) ?? 0;
    perCity.set(l.cityId, i + 1);
    return {
      id: l.id, tier: "landmark" as const, lat: l.lat, lng: l.lng,
      spriteUrl: `./atlas/pins/${l.domain}.png`,
      label: l.name, color: l.color, staggerIndex: i,
      title: l.whyItMatters || l.name,
    };
  });
  return [...continents, ...cities, ...landmarks];
}
