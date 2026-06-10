import type { ArcView, AtlasView, ContinentView, CityView, LandmarkView } from "../adapters/atlas";
import { DOMAIN_STORY } from "../adapters/atlas";
import { EvidenceChips } from "./EvidenceChips";

export type DetailNode =
  | { kind: "continent"; continent: ContinentView }
  | { kind: "city"; city: CityView }
  | { kind: "landmark"; landmark: LandmarkView }
  | null;

function RelatedFlows({ flows }: { flows: ArcView[] }) {
  if (flows.length === 0) return null;
  return (
    <div className="atlas-related-flows" data-testid="related-flows">
      <span className="atlas-section-label">Related flows</span>
      <ul>
        {flows.map((f) => (
          <li key={f.id} className="flow-chip">
            <span className="flow-endpoints">{f.sourceName} → {f.targetName}</span>
            <span className="flow-type">{f.label ?? f.type}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Drill-down list: the children one altitude below the selection.
function ChildList({ label, items, onSelect }: { label: string; items: { id: string; name: string }[]; onSelect?: (id: string) => void }) {
  if (items.length === 0 || !onSelect) return null;
  return (
    <div className="atlas-child-list">
      <span className="atlas-section-label">{label}</span>
      <ul>
        {items.map((it) => (
          <li key={it.id}>
            <button type="button" onClick={() => onSelect(it.id)}>{it.name}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AtlasDetail({
  node,
  view,
  flows = [],
  onSelect,
}: {
  node: DetailNode;
  view?: AtlasView;
  flows?: ArcView[];
  onSelect?: (id: string) => void;
}) {
  if (!node) {
    return (
      <aside className="atlas-detail" data-testid="atlas-detail">
        <p className="atlas-detail-empty">Select a landmark to see why it matters.</p>
      </aside>
    );
  }
  if (node.kind === "continent") {
    const c = node.continent;
    const story = DOMAIN_STORY[c.domain];
    const cities = view
      ? view.cities
          .filter((x) => x.continentId === c.id)
          .map((x) => ({ id: x.id, name: x.anchorName ? `${x.name} · ${x.anchorName}` : x.name }))
      : [];
    return (
      <aside className="atlas-detail" data-testid="atlas-detail">
        <span className="atlas-detail-kind">Continent</span>
        <h3>{c.title} <span className="atlas-tech">{c.continentName}</span></h3>
        <figure className="atlas-story-card">
          <img src={`./atlas/landmarks/${c.domain}.png`} alt={c.motif} className="atlas-story-art" />
          <figcaption>
            <blockquote className="atlas-story-concept">“{story.concept}”</blockquote>
            <p className="atlas-story-lesson">{story.lesson}</p>
            <span className="atlas-story-motif">{c.motif}</span>
          </figcaption>
        </figure>
        <p>{c.summary}</p>
        <p className="atlas-detail-counts">{c.cityCount} cities · {c.landmarkCount} landmarks</p>
        <ChildList label="Cities" items={cities} onSelect={onSelect} />
        <RelatedFlows flows={flows} />
        <EvidenceChips evidence={c.evidence} />
      </aside>
    );
  }
  if (node.kind === "city") {
    const c = node.city;
    const lms = view ? view.landmarks.filter((x) => x.cityId === c.id) : [];
    return (
      <aside className="atlas-detail" data-testid="atlas-detail">
        <span className="atlas-detail-kind">City</span>
        <h3>{c.name}{c.anchorName && <span className="atlas-tech">{c.anchorName}</span>}</h3>
        {c.summary && <p>{c.summary}</p>}
        <ChildList label="Landmarks" items={lms} onSelect={onSelect} />
        <RelatedFlows flows={flows} />
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
      <RelatedFlows flows={flows} />
      <EvidenceChips evidence={landmark.evidence} />
    </aside>
  );
}
