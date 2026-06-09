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
  return (
    <div className="camera-altitudes" data-testid="camera-altitudes">
      <h3>Camera altitudes (what you see)</h3>
      <table>
        <tbody>
          {view.continents.map((c) => (
            <tr key={c.id} onClick={() => onSelect(c.id)}>
              <td><span className="domain-dot" style={{ background: c.color }} /> {c.title} <span className="muted">({c.continentName})</span></td>
              <td className="muted">{QUESTION[c.domain]}</td>
              <td className="nums">{c.cityCount} cities · {c.landmarkCount} landmarks</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="camera-altitudes-note">The atlas is also available as an outline in the export (Markdown/HTML) with Mermaid flow diagrams.</p>
    </div>
  );
}
