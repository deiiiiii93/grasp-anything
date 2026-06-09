import { CONTINENT_GEO } from "../adapters/atlas";
import type { AtlasDomain } from "@grasp/schema";

const QUESTIONS: Record<AtlasDomain, string> = {
  architecture: "How is the system structured?",
  modules: "What are the building blocks?",
  workflows: "How does runtime flow work?",
  businessFlows: "How does user/value flow?",
  techSelection: "What was chosen and why?",
  uiUxTaste: "What is the design sensibility?",
};
const LABELS: Record<AtlasDomain, string> = {
  architecture: "Architecture",
  modules: "Modules",
  workflows: "Workflows",
  businessFlows: "Business Flows",
  techSelection: "Technical Selection",
  uiUxTaste: "UI/UX Taste",
};
const ORDER: AtlasDomain[] = ["architecture", "modules", "workflows", "businessFlows", "techSelection", "uiUxTaste"];

export function AtlasIntro() {
  return (
    <aside className="atlas-intro" data-testid="atlas-intro">
      <h2>Product Atlas</h2>
      <p className="atlas-intro-tagline">How it works — explore from Orbit to Landmark.</p>
      <p className="atlas-intro-blurb">A 3D globe that maps how this product works across six dimensions — from the big picture down to the details.</p>
      <h3 className="atlas-intro-h">Six domains · Six continents</h3>
      <ul className="atlas-intro-domains">
        {ORDER.map((d) => (
          <li key={d}>
            <span className="domain-dot" style={{ background: CONTINENT_GEO[d].color }} />
            <span className="domain-name">
              {LABELS[d]}
              <span className="domain-continent"> → {CONTINENT_GEO[d].continentName}</span>
            </span>
            <span className="domain-q">{QUESTIONS[d]}</span>
            <span className="domain-motif">{CONTINENT_GEO[d].motif}</span>
          </li>
        ))}
      </ul>
      <p className="atlas-intro-antarctica">Antarctica (optional) — Uncharted / low confidence (Phase 2+).</p>
    </aside>
  );
}
