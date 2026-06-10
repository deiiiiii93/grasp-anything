import type { AtlasDomain } from "@grasp/schema";
import type { AtlasView, ContinentView, LandmarkView } from "./atlas";
import { DOMAIN_STORY } from "./atlas";

// One stop of the guided trip. `id` drives the existing selection/camera
// machinery (null = orbit), so the voyage adds no new globe code paths.
export interface VoyageStop {
  id: string | null;
  kind: "orbit" | "continent" | "landmark" | "outro";
  chapter?: number; // 1-based, per visited continent
  title: string;
  subtitle?: string; // continent name · motif
  concept?: string; // the domain's teaching epigraph
  body: string;
}

// Canonical chapter order — the reading order of the six domains.
const DOMAIN_ORDER: AtlasDomain[] = [
  "architecture", "modules", "workflows", "businessFlows", "techSelection", "uiUxTaste",
];

// The spotlight: the richest city's most explainable landmark. Pure and
// deterministic — ties resolve to the earliest entry.
function spotlightLandmark(view: AtlasView, cont: ContinentView): LandmarkView | undefined {
  const cities = view.cities.filter((c) => c.continentId === cont.id);
  let best: { count: number; cityId: string } | null = null;
  for (const city of cities) {
    const count = view.landmarks.filter((l) => l.cityId === city.id).length;
    if (count > 0 && (!best || count > best.count)) best = { count, cityId: city.id };
  }
  if (!best) return undefined;
  const inCity = view.landmarks.filter((l) => l.cityId === best!.cityId);
  return inCity.find((l) => l.whyItMatters) ?? inCity[0];
}

/** Build the guided trip: orbit intro → per continent (story, then spotlight) → orbit outro. */
export function buildVoyage(view: AtlasView): VoyageStop[] {
  const stops: VoyageStop[] = [
    {
      id: null,
      kind: "orbit",
      title: "Product Atlas",
      body: "Six domains, six continents — a guided trip through how this product works, from orbit down to the landmarks.",
    },
  ];

  const byDomain = new Map(view.continents.map((c) => [c.domain, c]));
  let chapter = 0;
  for (const domain of DOMAIN_ORDER) {
    const cont = byDomain.get(domain);
    if (!cont) continue;
    chapter += 1;
    const story = DOMAIN_STORY[domain];
    stops.push({
      id: cont.id,
      kind: "continent",
      chapter,
      title: cont.title,
      subtitle: `${cont.continentName} · ${cont.motif}`,
      concept: story.concept,
      body: cont.summary,
    });
    const lm = spotlightLandmark(view, cont);
    if (lm) {
      stops.push({
        id: lm.id,
        kind: "landmark",
        chapter,
        title: lm.name,
        subtitle: lm.techTag,
        body: [lm.detail, lm.whyItMatters].filter(Boolean).join(" — "),
      });
    }
  }

  stops.push({
    id: null,
    kind: "outro",
    title: "End of the voyage",
    body: "The map stays open — descend anywhere that made you curious.",
  });
  return stops;
}
