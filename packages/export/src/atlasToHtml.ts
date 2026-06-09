import type { BriefDoc } from "@grasp/schema";
import { CONTINENT_GEO } from "@grasp/dashboard/adapters";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function atlasToHtml(doc: BriefDoc): string {
  const parts: string[] = [`<section class="atlas"><h2>How it works</h2>`];
  for (const c of doc.atlas.continents) {
    const continentName = CONTINENT_GEO[c.domain].continentName;
    parts.push(`<article><h3>${esc(c.title)} <span class="continent">${esc(continentName)}</span></h3><p>${esc(c.summary)}</p>`);
    for (const city of c.cities) {
      parts.push(`<h4>${esc(city.name)}</h4><ul>`);
      for (const lm of city.landmarks) {
        const tech = lm.techTag ? ` <em>${esc(lm.techTag)}</em>` : "";
        const detail = lm.detail ? ` — ${esc(lm.detail)}` : "";
        const why = lm.whyItMatters ? `<div class="why">Why it matters: ${esc(lm.whyItMatters)}</div>` : "";
        parts.push(`<li><strong>${esc(lm.name)}</strong>${tech}${detail}${why}</li>`);
      }
      parts.push(`</ul>`);
    }
    if (c.flows.length) {
      const nameById = new Map<string, string>();
      for (const city of c.cities) { nameById.set(city.id, city.name); for (const lm of city.landmarks) nameById.set(lm.id, lm.name); }
      parts.push(`<ol class="flows">`);
      for (const fl of c.flows) {
        const s = esc(nameById.get(fl.source) ?? fl.source);
        const t = esc(nameById.get(fl.target) ?? fl.target);
        const lbl = esc(fl.label ?? fl.type);
        parts.push(`<li>${s} <span class="flow-type">${lbl}</span> → ${t}</li>`);
      }
      parts.push(`</ol>`);
    }
    parts.push(`</article>`);
  }
  parts.push(`</section>`);
  return parts.join("");
}
