import type { BriefDoc } from "@grasp/schema";

export function App({ doc }: { doc: BriefDoc }) {
  return (
    <main className="app">
      <h1>{doc.meta.repo}</h1>
    </main>
  );
}
