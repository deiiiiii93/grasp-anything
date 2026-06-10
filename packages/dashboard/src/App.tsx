import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { BriefDoc } from "@grasp/schema";
import { buildCards, buildSignals } from "./adapters/brief";
import { buildAtlasView, relatedFlows, selectionContext } from "./adapters/atlas";
import { buildVoyage } from "./adapters/voyage";
import { VoyageOverlay } from "./components/VoyageOverlay";
import { Header } from "./components/Header";
import { BriefCard } from "./components/BriefCard";
import { LandscapeGraph } from "./components/LandscapeGraph";
import { AtlasOutline } from "./components/AtlasOutline";
import { AtlasDetail, type DetailNode } from "./components/AtlasDetail";
import { AtlasIntro } from "./components/AtlasIntro";
import { AltitudeRail } from "./components/AltitudeRail";
import { HowItWorks } from "./components/HowItWorks";
import { CameraAltitudesTable } from "./components/CameraAltitudesTable";
import { AtlasListPanel } from "./components/AtlasListPanel";

const AtlasGlobe = lazy(() => import("./components/AtlasGlobe"));

type Tab = "strategic" | "atlas" | "landscape" | "evidence";
type Theme = "dark" | "light";

// Saved preference wins; otherwise follow the OS. Storage can be unavailable
// (file://, privacy modes) — fall back silently.
function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem("grasp-theme");
    if (saved === "light" || saved === "dark") return saved;
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
  } catch { /* default below */ }
  return "dark";
}

const GUARANTEES = [
  ["♿", "Accessible", "Use List view for screen readers and keyboard navigation."],
  ["📤", "Export ready", "The atlas exports as a structured outline + Mermaid flows."],
  ["🔒", "Secure by default", "All items and links are escaped; only safe links open."],
  ["🎯", "Deterministic layout", "Continents and landmarks are placed reproducibly."],
  ["🧭", "Fallback", "If WebGL is unavailable, the outline is shown."],
] as const;

export function App({ doc }: { doc: BriefDoc }) {
  const signals = buildSignals(doc);
  const cards = buildCards(doc);
  const view = useMemo(() => buildAtlasView(doc), [doc]);
  const [tab, setTab] = useState<Tab>("atlas");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listView, setListView] = useState(false);
  const [voyaging, setVoyaging] = useState(false);
  const voyage = useMemo(() => buildVoyage(view), [view]);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("grasp-theme", theme); } catch { /* storage unavailable */ }
  }, [theme]);

  const ctx = useMemo(() => selectionContext(view, selectedId), [view, selectedId]);
  const detailNode: DetailNode = useMemo(() => {
    if (ctx.landmarkId) { const l = view.landmarks.find((x) => x.id === ctx.landmarkId); return l ? { kind: "landmark", landmark: l } : null; }
    if (ctx.cityId) { const c = view.cities.find((x) => x.id === ctx.cityId); return c ? { kind: "city", city: c } : null; }
    if (ctx.continentId) { const c = view.continents.find((x) => x.id === ctx.continentId); return c ? { kind: "continent", continent: c } : null; }
    return null;
  }, [ctx, view]);
  const crumb = useMemo(() => {
    const parts: string[] = ["Atlas"];
    const lm = view.landmarks.find((l) => l.id === selectedId);
    const city = view.cities.find((c) => c.id === selectedId) ?? (lm && view.cities.find((c) => c.id === lm.cityId));
    const contId = lm?.continentId ?? city?.continentId ?? view.continents.find((c) => c.id === selectedId)?.id;
    const cont = view.continents.find((c) => c.id === contId);
    if (cont) parts.push(cont.title, cont.continentName);
    if (city) parts.push(city.name);
    if (lm) parts.push(lm.name);
    return parts;
  }, [selectedId, view]);
  const level = ctx.level;

  const ascendTo = (n: 1 | 2 | 3 | 4) => {
    if (n <= 1) return setSelectedId(null);
    if (n === 2) return setSelectedId(ctx.continentId);
    if (n === 3) return setSelectedId(ctx.cityId ?? ctx.continentId);
  };

  return (
    <main className="app">
      <Header signals={signals} />
      <div className="nav-row">
        <nav className="top-nav" role="tablist">
          {(["strategic", "atlas", "landscape", "evidence"] as Tab[]).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
              {t === "strategic" ? "Strategic" : t === "atlas" ? "Atlas" : t === "landscape" ? "Landscape" : "Evidence"}
            </button>
          ))}
        </nav>
        <button
          type="button"
          className="theme-toggle"
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </div>

      {tab === "strategic" && (
        <section className="cards-grid">
          {cards.map((card) => (
            <BriefCard key={card.key} card={card} />
          ))}
        </section>
      )}

      {tab === "atlas" && (
        <>
          <div className="atlas-grid">
            <AtlasIntro />
            <div className="atlas-center">
              <div className="atlas-crumb-row">
                <span className="atlas-breadcrumb" data-testid="atlas-breadcrumb">{crumb.join(" › ")}</span>
                <button type="button" className="voyage-toggle" aria-pressed={voyaging} onClick={() => setVoyaging((v) => !v)}>
                  {voyaging ? "✕ End voyage" : "▶ Voyage"}
                </button>
                <button type="button" className="list-view-toggle" aria-pressed={listView} onClick={() => setListView((v) => !v)}>List view</button>
              </div>
              <div className="atlas-stage">
                {listView ? (
                  <AtlasOutline view={view} selectedId={selectedId} onSelect={setSelectedId} />
                ) : (
                  <Suspense fallback={<div className="atlas-globe" data-testid="atlas-globe-loading">Loading globe…</div>}>
                    <AtlasGlobe view={view} selectedId={selectedId} onSelect={setSelectedId} />
                  </Suspense>
                )}
                {voyaging && (
                  <VoyageOverlay stops={voyage} onNavigate={setSelectedId} onExit={() => setVoyaging(false)} />
                )}
              </div>
              <AltitudeRail level={level} onAscend={ascendTo} />
            </div>
            <AtlasDetail node={detailNode} view={view} flows={relatedFlows(view, selectedId)} onSelect={setSelectedId} />
          </div>
          <div className="atlas-bottom">
            <CameraAltitudesTable view={view} onSelect={setSelectedId} />
            <AtlasListPanel view={view} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
          <HowItWorks view={view} />
        </>
      )}

      {tab === "landscape" && (
        <section className="graphs">
          <LandscapeGraph doc={doc} />
        </section>
      )}

      {tab === "evidence" && (
        <section className="evidence-list" data-testid="evidence-list">
          <h2>Evidence</h2>
          <ul>
            {doc.evidence.map((e) => (
              <li key={e.id}>
                <strong>{e.claim}</strong> — {e.source} {e.verified ? "(verified)" : "(inferred)"}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="atlas-guarantees">
        {GUARANTEES.map(([icon, t, d]) => (
          <div key={t} className="guarantee">
            <span className="guarantee-title"><span className="guarantee-icon" aria-hidden="true">{icon}</span> {t}</span>
            <span className="guarantee-desc">{d}</span>
          </div>
        ))}
        <div className="phase-badges"><span>Phase 1</span><span>Phase 2</span><span>Phase 3</span></div>
      </footer>
    </main>
  );
}
