import type { AtlasView } from "../adapters/atlas";
import { selectionContext } from "../adapters/atlas";

const LEVEL_NAME = { 1: "Orbit", 2: "Continent", 3: "City", 4: "Landmark" } as const;

// The mockup's top-left altitude chip: where the camera is and what it shows.
export function AltitudeBadge({ view, selectedId }: { view: AtlasView; selectedId: string | null }) {
  const ctx = selectionContext(view, selectedId);
  let caption = "Whole product · Six dimensions";
  if (ctx.level === 2) {
    const c = view.continents.find((x) => x.id === ctx.continentId);
    if (c) caption = `${c.title} · ${c.continentName}`;
  } else if (ctx.level === 3) {
    const c = view.cities.find((x) => x.id === ctx.cityId);
    if (c) caption = c.name;
  } else if (ctx.level === 4) {
    const l = view.landmarks.find((x) => x.id === ctx.landmarkId);
    if (l) caption = l.name;
  }
  return (
    <div className="altitude-badge" data-testid="altitude-badge">
      <span className="altitude-badge-level">{LEVEL_NAME[ctx.level]}</span>
      <span className="altitude-badge-caption">{caption}</span>
    </div>
  );
}
