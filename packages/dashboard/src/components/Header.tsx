import type { SignalsVM } from "../adapters/brief";

export function Header({ signals }: { signals: SignalsVM }) {
  return (
    <header className="app-header">
      <div className="app-title">
        {signals.url ? (
          <a href={signals.url} target="_blank" rel="noreferrer">
            {signals.repo}
          </a>
        ) : (
          <span>{signals.repo}</span>
        )}
      </div>
      <p className="verdict">{signals.takeaway}</p>
      <ul className="signal-chips">
        {signals.stars !== undefined && <li className="chip">★ {signals.stars.toLocaleString("en-US")}</li>}
        {signals.language && <li className="chip">{signals.language}</li>}
        <li className="chip">depth: {signals.depth}</li>
        <li className="chip">scope: {signals.broadness}</li>
      </ul>
    </header>
  );
}
