import { useState } from "react";
import type { BriefDoc } from "@grasp/schema";
import { briefToMarkdown, briefToPrintHtml } from "@grasp/export";

// Client-side download: the export renderers are pure string builders, so the
// dashboard can produce the same report.md / report.html as the grasp-export CLI.
function download(name: string, mime: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ExportMenu({ doc }: { doc: BriefDoc }) {
  const [open, setOpen] = useState(false);
  const items = [
    { label: "Report — Markdown", hint: "report.md · outline + Mermaid flows", run: () => download("report.md", "text/markdown", briefToMarkdown(doc)) },
    { label: "Print page — HTML", hint: "report.html · open & print for a PDF", run: () => download("report.html", "text/html", briefToPrintHtml(doc)) },
    { label: "Brief data — JSON", hint: "repo-brief.json · the raw contract", run: () => download("repo-brief.json", "application/json", JSON.stringify(doc, null, 2)) },
  ];
  return (
    <div className="export-menu">
      <button
        type="button"
        className="export-toggle"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Export
      </button>
      {open && (
        <>
          <div className="export-backdrop" onClick={() => setOpen(false)} />
          <ul className="export-dropdown" role="menu">
            {items.map((it) => (
              <li key={it.label} role="none">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    it.run();
                    setOpen(false);
                  }}
                >
                  <span className="export-item-label">{it.label}</span>
                  <span className="export-item-hint">{it.hint}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
