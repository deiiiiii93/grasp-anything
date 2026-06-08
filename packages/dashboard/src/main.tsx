import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { validateBrief } from "@grasp/schema";
import { App } from "./App";
import "./index.css";

function ErrorScreen({ message }: { message: string }) {
  return <pre className="error-screen">{message}</pre>;
}

async function boot() {
  const root = createRoot(document.getElementById("root")!);
  try {
    const res = await fetch("./repo-brief.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    const { ok, errors, data } = validateBrief(raw);
    if (!ok || !data) {
      root.render(
        <StrictMode>
          <ErrorScreen message={`Invalid repo-brief.json:\n${errors.join("\n")}`} />
        </StrictMode>,
      );
      return;
    }
    root.render(
      <StrictMode>
        <App doc={data} />
      </StrictMode>,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    root.render(
      <StrictMode>
        <ErrorScreen message={`Could not load repo-brief.json: ${message}`} />
      </StrictMode>,
    );
  }
}

boot();
