import { useState } from "react";
import type { BriefDoc } from "@grasp/schema";
import { buildCards, buildSignals } from "./adapters/brief";
import { Header } from "./components/Header";
import { BriefCard } from "./components/BriefCard";
import { ConceptGraph } from "./components/ConceptGraph";
import { LandscapeGraph } from "./components/LandscapeGraph";

type GraphTab = "concept" | "landscape";

export function App({ doc }: { doc: BriefDoc }) {
  const signals = buildSignals(doc);
  const cards = buildCards(doc);
  const [tab, setTab] = useState<GraphTab>("concept");

  return (
    <main className="app">
      <Header signals={signals} />
      <section className="cards-grid">
        {cards.map((card) => (
          <BriefCard key={card.key} card={card} />
        ))}
      </section>
      <section className="graphs">
        <div className="graph-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "concept"}
            className={tab === "concept" ? "active" : ""}
            onClick={() => setTab("concept")}
          >
            Concept map
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "landscape"}
            className={tab === "landscape" ? "active" : ""}
            onClick={() => setTab("landscape")}
          >
            Landscape
          </button>
        </div>
        {tab === "concept" ? <ConceptGraph doc={doc} /> : <LandscapeGraph doc={doc} />}
      </section>
    </main>
  );
}
