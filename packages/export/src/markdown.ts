import type { BriefDoc } from "@grasp/schema";
import { landscapeToMermaid } from "./mermaid";
import { atlasToMarkdown } from "./atlasToMarkdown";
import { safeHref } from "./url";

const SECTIONS: { key: "idea" | "problem" | "why" | "how" | "takeaway"; title: string }[] = [
  { key: "idea", title: "Idea" },
  { key: "problem", title: "Problem" },
  { key: "why", title: "Why it wins" },
  { key: "how", title: "How" },
  { key: "takeaway", title: "Takeaway" },
];

export function briefToMarkdown(doc: BriefDoc): string {
  const out: string[] = [`# ${doc.meta.repo}`, "", `> ${doc.brief.takeaway}`, ""];

  const signals: string[] = [];
  if (doc.meta.signals.stars !== undefined) signals.push(`${doc.meta.signals.stars}★`);
  if (doc.meta.signals.language) signals.push(doc.meta.signals.language);
  signals.push(`${doc.meta.depth} × ${doc.meta.broadness}`);
  out.push(`\`${signals.join(" · ")}\``, "");

  const evidenceMap = doc.brief.evidence ?? {};
  const cited: string[] = [];

  for (const { key, title } of SECTIONS) {
    const ids = evidenceMap[key] ?? [];
    for (const id of ids) if (!cited.includes(id)) cited.push(id);
    const markers = ids.map((id) => `[^${id}]`).join("");
    out.push(`## ${title}`, `${doc.brief[key]}${markers ? ` ${markers}` : ""}`, "");
  }

  out.push(atlasToMarkdown(doc));
  out.push("## Competitive landscape", "", "```mermaid", landscapeToMermaid(doc), "```", "");

  if (cited.length > 0) {
    const byId = new Map(doc.evidence.map((e) => [e.id, e]));
    out.push("");
    for (const id of cited) {
      const e = byId.get(id);
      if (!e) continue;
      // Escape `]` in the link text and `()` in the destination so an untrusted
      // source/url can't break out of the `[text](url)` syntax and inject markdown.
      const linkText = e.source.replace(/[[\]]/g, "\\$&");
      const src = e.url
        ? `[${linkText}](${safeHref(e.url).replace(/[()]/g, (c) => (c === "(" ? "%28" : "%29"))})`
        : e.source;
      out.push(`[^${id}]: ${e.claim} — ${src} (${e.verified ? "verified" : "inferred"})`);
    }
  }

  return `${out.join("\n")}\n`;
}
