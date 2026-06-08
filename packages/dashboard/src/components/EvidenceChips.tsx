import type { EvidenceChip } from "../adapters/brief";

export function EvidenceChips({ evidence }: { evidence: EvidenceChip[] }) {
  if (evidence.length === 0) return null;
  return (
    <span className="evidence-chips">
      {evidence.map((e, i) => (
        <span
          key={e.id}
          data-testid="evidence-chip"
          role="img"
          // role="img" + aria-label conveys the verified/inferred status to assistive
          // tech, so the meaning is not carried by color (and the hover-only title) alone.
          aria-label={`Evidence ${i + 1}: ${e.claim} — ${e.source} (${e.verified ? "verified" : "inferred"})`}
          className={`evidence-chip ${e.verified ? "verified" : "inferred"}`}
          title={`${e.claim} — ${e.source} (${e.verified ? "verified" : "inferred"})`}
        >
          {i + 1}
        </span>
      ))}
    </span>
  );
}
