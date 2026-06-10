import type { AtlasView } from "../adapters/atlas";
import { DOMAIN_STORY } from "../adapters/atlas";
import { EvidenceChips } from "./EvidenceChips";

export function HowItWorks({ view }: { view: AtlasView }) {
  return (
    <section className="how-it-works" data-testid="how-it-works">
      <h2>How it works</h2>
      {view.continents.map((c, i) => (
        <article key={c.id} className="how-domain">
          <h3>
            <span className="how-chapter">Chapter {i + 1}</span> {c.title}{" "}
            <span className="how-continent">{c.continentName} · {c.motif}</span>
          </h3>
          <p className="how-concept">“{DOMAIN_STORY[c.domain].concept}”</p>
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
