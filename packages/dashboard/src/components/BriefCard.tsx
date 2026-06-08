import type { BriefCardVM } from "../adapters/brief";
import { EvidenceChips } from "./EvidenceChips";

export function BriefCard({ card }: { card: BriefCardVM }) {
  return (
    <article className={`brief-card card-${card.key}`} data-testid={`card-${card.key}`}>
      <div className="brief-card-head">
        <h2>{card.title}</h2>
        <EvidenceChips evidence={card.evidence} />
      </div>
      <p>{card.body}</p>
    </article>
  );
}
