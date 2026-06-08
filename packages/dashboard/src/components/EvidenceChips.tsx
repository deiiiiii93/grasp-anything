import type { EvidenceChip } from "../adapters/brief";

export function EvidenceChips({ evidence }: { evidence: EvidenceChip[] }) {
  if (evidence.length === 0) return null;
  return (
    <span className="evidence-chips">
      {evidence.map((e, i) => (
        <span
          key={e.id}
          data-testid="evidence-chip"
          className={`evidence-chip ${e.verified ? "verified" : "inferred"}`}
          title={`${e.claim} — ${e.source} (${e.verified ? "verified" : "inferred"})`}
        >
          {i + 1}
        </span>
      ))}
    </span>
  );
}
