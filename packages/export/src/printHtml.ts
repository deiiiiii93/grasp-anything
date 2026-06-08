import type { BriefDoc } from "@grasp/schema";
import { conceptToSvg, landscapeToSvg } from "./svg";

const SECTIONS: { key: "idea" | "problem" | "why" | "how" | "takeaway"; title: string }[] = [
  { key: "idea", title: "Idea" },
  { key: "problem", title: "Problem" },
  { key: "why", title: "Why it wins" },
  { key: "how", title: "How" },
  { key: "takeaway", title: "Takeaway" },
];

const STYLE = `
* { box-sizing: border-box; }
body { font: 15px/1.55 -apple-system, system-ui, "Segoe UI", sans-serif; color: #1a1a1a; max-width: 820px; margin: 0 auto; padding: 32px; }
h1 { margin: 0 0 4px; font-size: 26px; }
h1 a { color: inherit; text-decoration: none; }
.verdict { color: #555; font-size: 18px; margin: 0 0 12px; }
.chips { color: #777; font-size: 13px; margin: 0 0 24px; }
section { margin: 16px 0; page-break-inside: avoid; }
h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .07em; color: #777; margin: 0 0 4px; }
section p { margin: 0; }
sup { color: #b36; font-size: 11px; }
.graph { width: 100%; height: auto; border: 1px solid #e2e2e2; border-radius: 8px; background: #fff; }
.graph .edge { stroke: #c2c2c2; stroke-width: 1.5; }
.graph circle { stroke: #fff; stroke-width: 2; }
.graph text { fill: #1a1a1a; font-size: 11px; }
.refs { font-size: 13px; color: #555; border-top: 1px solid #e2e2e2; margin-top: 24px; padding-top: 12px; }
.refs .inferred { color: #b8860b; font-weight: 600; }
@page { margin: 18mm; }
@media print { body { padding: 0; max-width: none; } section, .graph { break-inside: avoid; } }
`;

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function briefToPrintHtml(doc: BriefDoc): string {
  const evidenceMap = doc.brief.evidence ?? {};
  const byId = new Map(doc.evidence.map((e) => [e.id, e]));
  const refs: string[] = [];
  const refNum = (id: string): number => {
    if (!refs.includes(id)) refs.push(id);
    return refs.indexOf(id) + 1;
  };

  const sectionsHtml = SECTIONS.map(({ key, title }) => {
    const sups = (evidenceMap[key] ?? [])
      .map((id) => `<sup>[${refNum(id)}]</sup>`)
      .join("");
    return `<section><h2>${title}</h2><p>${esc(doc.brief[key])}${sups}</p></section>`;
  }).join("");

  const chips: string[] = [];
  if (doc.meta.signals.stars !== undefined) chips.push(`${doc.meta.signals.stars}★`);
  if (doc.meta.signals.language) chips.push(esc(doc.meta.signals.language));
  chips.push(`${doc.meta.depth} × ${doc.meta.broadness}`);

  const refsHtml =
    refs.length > 0
      ? `<div class="refs"><strong>References</strong><ol>${refs
          .map((id) => {
            const e = byId.get(id)!;
            const src = e.url ? `<a href="${esc(e.url)}">${esc(e.source)}</a>` : esc(e.source);
            const tag = e.verified ? "verified" : `<span class="inferred">inferred</span>`;
            return `<li>${esc(e.claim)} — ${src} (${tag})</li>`;
          })
          .join("")}</ol></div>`
      : "";

  const title = doc.meta.url
    ? `<a href="${esc(doc.meta.url)}">${esc(doc.meta.repo)}</a>`
    : esc(doc.meta.repo);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(doc.meta.repo)} — grasp brief</title><style>${STYLE}</style></head>
<body>
<h1>${title}</h1>
<p class="verdict">${esc(doc.brief.takeaway)}</p>
<p class="chips">${chips.join(" · ")}</p>
${sectionsHtml}
<section><h2>Concept map</h2>${conceptToSvg(doc)}</section>
<section><h2>Competitive landscape</h2>${landscapeToSvg(doc)}</section>
${refsHtml}
</body></html>
`;
}
