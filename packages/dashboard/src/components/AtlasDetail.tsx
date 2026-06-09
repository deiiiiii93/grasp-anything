import type { LandmarkView } from "../adapters/atlas";
import { EvidenceChips } from "./EvidenceChips";

export function AtlasDetail({ landmark }: { landmark: LandmarkView | null }) {
  if (!landmark) {
    return (
      <aside className="atlas-detail" data-testid="atlas-detail">
        <p className="atlas-detail-empty">Select a landmark to see why it matters.</p>
      </aside>
    );
  }
  return (
    <aside className="atlas-detail" data-testid="atlas-detail">
      <span className="atlas-detail-kind">Landmark</span>
      <h3>
        {landmark.name}
        {landmark.techTag && <span className="atlas-tech">{landmark.techTag}</span>}
      </h3>
      {landmark.detail && <p>{landmark.detail}</p>}
      {landmark.whyItMatters && (
        <div className="atlas-why">
          <span className="atlas-why-label">Why it matters</span>
          <p>{landmark.whyItMatters}</p>
        </div>
      )}
      {landmark.tags.length > 0 && (
        <ul className="atlas-tags">
          {landmark.tags.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
      <EvidenceChips evidence={landmark.evidence} />
    </aside>
  );
}
