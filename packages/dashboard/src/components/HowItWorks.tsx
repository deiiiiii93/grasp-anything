import type { AtlasView } from "../adapters/atlas";
import { EvidenceChips } from "./EvidenceChips";

export function HowItWorks({ view }: { view: AtlasView }) {
  return (
    <section className="how-it-works" data-testid="how-it-works">
      <h2>How it works</h2>
      {view.continents.map((c) => (
        <article key={c.id} className="how-domain">
          <h3>
            {c.title} <span className="how-continent">{c.continentName}</span>
          </h3>
          <p>{c.summary}</p>
          <p className="how-counts">
            {c.cityCount} cities · {c.landmarkCount} landmarks
          </p>
          <EvidenceChips evidence={c.evidence} />
        </article>
      ))}
    </section>
  );
}
