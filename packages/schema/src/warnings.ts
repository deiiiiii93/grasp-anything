import type { BriefDoc } from "./schema";

const MAX_LANDMARKS = 120;

/** Non-fatal advisories about a thin or oversized atlas. Never fails the brief. */
export function computeWarnings(doc: BriefDoc): string[] {
  const out: string[] = [];
  const continents = doc.atlas.continents;
  let landmarkCount = 0;
  let populated = 0;

  for (const c of continents) {
    if (c.cities.length > 0) populated += 1;
    if (c.summary && c.evidenceIds.length === 0)
      out.push(`continent '${c.domain}' has a summary but no evidence`);
    if (c.cities.length === 1)
      out.push(`continent '${c.domain}' is thin: only one city`);
    if ((c.domain === "workflows" || c.domain === "businessFlows") && c.cities.length > 0 && c.flows.length === 0)
      out.push(`flow continent '${c.domain}' has cities but no flows`);
    for (const city of c.cities) {
      if (city.landmarks.length === 0) out.push(`city '${city.name}' has zero landmarks`);
      for (const lm of city.landmarks) {
        landmarkCount += 1;
        if (!lm.detail) out.push(`landmark '${lm.name}' has no detail`);
        if (!lm.whyItMatters) out.push(`landmark '${lm.name}' has no whyItMatters`);
        if (lm.evidenceIds.length === 0) out.push(`landmark '${lm.name}' cites no evidence`);
      }
    }
  }

  if (populated < 3) out.push(`atlas has fewer than three populated continents (${populated})`);
  if (landmarkCount > MAX_LANDMARKS)
    out.push(`landmark count ${landmarkCount} exceeds the performance cap (${MAX_LANDMARKS})`);
  return out;
}
