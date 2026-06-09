import type { BriefDoc } from "@grasp/schema";

// Escape the chars that break Markdown link/emphasis syntax in body text.
export function mdText(s: string): string {
  return s.replace(/([\\`*_[\]()])/g, "\\$1");
}

export function atlasToMarkdown(doc: BriefDoc): string {
  const out: string[] = ["## How it works", ""];
  for (const c of doc.atlas.continents) {
    out.push(`### ${mdText(c.title)} — ${mdText(c.summary)}`, "");
    for (const city of c.cities) {
      out.push(`#### ${mdText(city.name)}`);
      if (city.summary) out.push(mdText(city.summary));
      for (const lm of city.landmarks) {
        const tech = lm.techTag ? ` (${mdText(lm.techTag)})` : "";
        const detail = lm.detail ? ` — ${mdText(lm.detail)}` : "";
        out.push(`- **${mdText(lm.name)}**${tech}${detail}`);
        if (lm.whyItMatters) out.push(`  - _Why it matters:_ ${mdText(lm.whyItMatters)}`);
      }
      out.push("");
    }
  }
  return `${out.join("\n")}\n`;
}
