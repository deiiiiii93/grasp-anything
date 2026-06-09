import type { ContinentView, CityView, LandmarkView } from "../adapters/atlas";
import { EvidenceChips } from "./EvidenceChips";

export type DetailNode =
  | { kind: "continent"; continent: ContinentView }
  | { kind: "city"; city: CityView }
  | { kind: "landmark"; landmark: LandmarkView }
  | null;

export function AtlasDetail({ node }: { node: DetailNode }) {
  if (!node) {
    return (
      <aside className="atlas-detail" data-testid="atlas-detail">
        <p className="atlas-detail-empty">Select a landmark to see why it matters.</p>
      </aside>
    );
  }
  if (node.kind === "continent") {
    const c = node.continent;
    return (
      <aside className="atlas-detail" data-testid="atlas-detail">
        <span className="atlas-detail-kind">Continent</span>
        <h3>{c.title} <span className="atlas-tech">{c.continentName}</span></h3>
        <p>{c.summary}</p>
        <p className="atlas-detail-counts">{c.cityCount} cities · {c.landmarkCount} landmarks</p>
        <EvidenceChips evidence={c.evidence} />
      </aside>
    );
  }
  if (node.kind === "city") {
    const c = node.city;
    return (
      <aside className="atlas-detail" data-testid="atlas-detail">
        <span className="atlas-detail-kind">City</span>
        <h3>{c.name}</h3>
        {c.summary && <p>{c.summary}</p>}
        <EvidenceChips evidence={c.evidence} />
      </aside>
    );
  }
  const landmark = node.landmark;
  return (
    <aside className="atlas-detail" data-testid="atlas-detail">
      <span className="atlas-detail-kind">Landmark</span>
      <h3>{landmark.name}{landmark.techTag && <span className="atlas-tech">{landmark.techTag}</span>}</h3>
      {landmark.detail && <p>{landmark.detail}</p>}
      {landmark.whyItMatters && (
        <div className="atlas-why"><span className="atlas-why-label">Why it matters</span><p>{landmark.whyItMatters}</p></div>
      )}
      {landmark.tags.length > 0 && (
        <ul className="atlas-tags">{landmark.tags.map((t) => (<li key={t}>{t}</li>))}</ul>
      )}
      <EvidenceChips evidence={landmark.evidence} />
    </aside>
  );
}
