import { useState } from "react";
import type { AtlasView } from "../adapters/atlas";
import { searchAtlas } from "../adapters/atlas";
import { AtlasOutline } from "./AtlasOutline";

// Mini mirror of the detail panel: enough to confirm a pick without scrolling
// back up to the right-hand panel.
function MiniCard({ view, selectedId }: { view: AtlasView; selectedId: string | null }) {
  const lm = view.landmarks.find((l) => l.id === selectedId);
  const city = lm ? undefined : view.cities.find((c) => c.id === selectedId);
  const cont = lm || city ? undefined : view.continents.find((c) => c.id === selectedId);
  if (!lm && !city && !cont) return null;
  const title = lm?.name ?? city?.name ?? cont?.title;
  const sub = lm?.techTag ?? (cont ? cont.continentName : undefined);
  const body = lm?.detail ?? city?.summary ?? cont?.summary;
  const evid = (lm?.evidence ?? city?.evidence ?? cont?.evidence ?? []).length;
  return (
    <div className="atlas-mini-card" data-testid="atlas-mini-card">
      <strong>{title}</strong>
      {sub && <span className="atlas-tech">{sub}</span>}
      {body && <p>{body}</p>}
      <span className="mini-evidence">Evidence ({evid})</span>
    </div>
  );
}

export function AtlasListPanel({
  view,
  selectedId,
  onSelect,
}: {
  view: AtlasView;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [tab, setTab] = useState<"outline" | "search">("outline");
  const [query, setQuery] = useState("");
  const hits = tab === "search" ? searchAtlas(view, query) : [];

  return (
    <div className="atlas-listview-panel" data-testid="atlas-list-panel">
      <div className="list-panel-head">
        <h3>List view (outline)</h3>
        <div className="list-panel-tabs" role="tablist">
          {(["outline", "search"] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
              {t === "outline" ? "Outline" : "Search"}
            </button>
          ))}
        </div>
      </div>
      {tab === "outline" ? (
        <AtlasOutline view={view} selectedId={selectedId} onSelect={onSelect} />
      ) : (
        <div className="atlas-search">
          <input
            type="search"
            placeholder="Search landmarks, tech, tags…"
            value={query}
            aria-label="Search the atlas"
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="atlas-search-hits">
            {hits.map((h) => (
              <li key={h.id}>
                <button type="button" onClick={() => onSelect(h.id)}>
                  <span className="outline-kind">{h.kind}</span> {h.title}
                  <span className="hit-context">{h.context}</span>
                </button>
              </li>
            ))}
            {query.trim() && hits.length === 0 && <li className="no-hits">No matches.</li>}
          </ul>
        </div>
      )}
      <MiniCard view={view} selectedId={selectedId} />
    </div>
  );
}
