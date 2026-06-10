// Regenerates public/atlas/world.geojson — Natural Earth 110m admin-0 countries
// (public domain), slimmed to one property per feature: { continent }.
// The asset is checked in; run this only to refresh it.
//   node scripts/fetch-world-geojson.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const SRC = "https://globe.gl/example/datasets/ne_110m_admin_0_countries.geojson";
const here = dirname(fileURLToPath(import.meta.url));
const dest = resolve(here, "../public/atlas/world.geojson");

const res = await fetch(SRC);
if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
const geo = await res.json();

const slim = {
  type: "FeatureCollection",
  features: geo.features.map((f) => ({
    type: "Feature",
    properties: { continent: f.properties.CONTINENT },
    geometry: f.geometry,
  })),
};
writeFileSync(dest, JSON.stringify(slim));
console.log(`wrote ${dest} (${slim.features.length} features)`);
