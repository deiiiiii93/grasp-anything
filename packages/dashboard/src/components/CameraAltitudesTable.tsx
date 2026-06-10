import { useState } from "react";
import type { AtlasView } from "../adapters/atlas";

const QUESTION: Record<string, string> = {
  architecture: "How is the system structured?",
  modules: "What are the building blocks?",
  workflows: "How does runtime flow work?",
  businessFlows: "How does user/value flow?",
  techSelection: "What was chosen and why?",
  uiUxTaste: "What is the design sensibility?",
};

export function CameraAltitudesTable({ view, onSelect }: { view: AtlasView; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const allOpen = open.size === view.continents.length && view.continents.length > 0;
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="camera-altitudes" data-testid="camera-altitudes">
      <div className="camera-altitudes-head">
        <h3>Camera altitudes (what you see)</h3>
        <button
          type="button"
          className="open-all"
          onClick={() => setOpen(allOpen ? new Set() : new Set(view.continents.map((c) => c.id)))}
        >
          {allOpen ? "Close all" : "Open all"}
        </button>
      </div>
      <table>
        <tbody>
          {view.continents.map((c) => (
            [
              <tr key={c.id} className="continent-row">
                <td>
                  <button type="button" className="row-expand" aria-expanded={open.has(c.id)} aria-label={`Toggle ${c.title} cities`} onClick={() => toggle(c.id)}>
                    {open.has(c.id) ? "▾" : "▸"}
                  </button>
                  <button type="button" className="row-title" onClick={() => onSelect(c.id)}>
                    <span className="domain-dot" style={{ background: c.color }} /> {c.title} <span className="muted">({c.continentName})</span>
                  </button>
                </td>
                <td className="muted">{QUESTION[c.domain]}</td>
                <td className="nums">{c.cityCount} cities · {c.landmarkCount} landmarks</td>
              </tr>,
              ...(open.has(c.id)
                ? view.cities
                    .filter((city) => city.continentId === c.id)
                    .map((city) => (
                      <tr key={city.id} className="city-row">
                        <td colSpan={2}>
                          <button type="button" className="row-title city" onClick={() => onSelect(city.id)}>{city.name}</button>
                        </td>
                        <td className="nums">{view.landmarks.filter((l) => l.cityId === city.id).length} landmarks</td>
                      </tr>
                    ))
                : []),
            ]
          ))}
        </tbody>
      </table>
      <p className="camera-altitudes-note">The atlas is also available as an outline in the export (Markdown/HTML) with Mermaid flow diagrams.</p>
    </div>
  );
}
