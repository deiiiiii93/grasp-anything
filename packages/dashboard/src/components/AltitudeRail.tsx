const STEPS = [
  { n: 1, label: "Orbit", caption: "Whole product" },
  { n: 2, label: "Continent", caption: "Explore one" },
  { n: 3, label: "City", caption: "Landmarks & flows" },
  { n: 4, label: "Landmark", caption: "Details & evidence" },
] as const;

export function AltitudeRail({ level }: { level: 1 | 2 | 3 | 4 }) {
  return (
    <ol className="altitude-rail" data-testid="altitude-rail">
      {STEPS.map((s) => (
        <li key={s.n} className={s.n === level ? "active" : ""} aria-current={s.n === level ? "step" : undefined}>
          <span className="rail-n">{s.n}</span>
          <span className="rail-label">{s.label}</span>
          <span className="rail-caption">{s.caption}</span>
        </li>
      ))}
    </ol>
  );
}
