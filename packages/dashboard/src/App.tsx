import type { BriefDoc } from "@grasp/schema";
import { buildCards, buildSignals } from "./adapters/brief";
import { Header } from "./components/Header";
import { BriefCard } from "./components/BriefCard";

export function App({ doc }: { doc: BriefDoc }) {
  const signals = buildSignals(doc);
  const cards = buildCards(doc);
  return (
    <main className="app">
      <Header signals={signals} />
      <section className="cards-grid">
        {cards.map((card) => (
          <BriefCard key={card.key} card={card} />
        ))}
      </section>
    </main>
  );
}
