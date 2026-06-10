import { useEffect, useState } from "react";
import type { VoyageStop } from "../adapters/voyage";

const ADVANCE_MS = 7000;

// The "Soaring Over the Horizon" ride: walks the stops, driving the globe's
// selection (and thus the camera) through onNavigate. Owns play/pause state;
// the parent owns whether the voyage exists at all.
export function VoyageOverlay({
  stops,
  onNavigate,
  onExit,
}: {
  stops: VoyageStop[];
  onNavigate: (id: string | null) => void;
  onExit: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const stop = stops[index];
  const last = index === stops.length - 1;

  // Each stop change flies the camera by selecting that stop's node.
  useEffect(() => {
    onNavigate(stop.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Auto-advance; pause at the outro instead of looping.
  useEffect(() => {
    if (!playing || last) return;
    const t = setInterval(() => setIndex((i) => Math.min(i + 1, stops.length - 1)), ADVANCE_MS);
    return () => clearInterval(t);
  }, [playing, last, stops.length]);

  return (
    <div className="voyage-overlay" data-testid="voyage-overlay" role="dialog" aria-label="Atlas voyage">
      <div className="voyage-card">
        {stop.chapter != null && <span className="voyage-chapter">Chapter {stop.chapter}</span>}
        <h3 className="voyage-title">{stop.title}</h3>
        {stop.subtitle && <p className="voyage-subtitle">{stop.subtitle}</p>}
        {stop.concept && <blockquote className="voyage-concept">“{stop.concept}”</blockquote>}
        <p className="voyage-body">{stop.body}</p>
        <div className="voyage-controls">
          <button type="button" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} aria-label="Previous stop">‹ Prev</button>
          <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"}>
            {playing ? "❚❚ Pause" : "▶ Play"}
          </button>
          <button type="button" onClick={() => setIndex((i) => Math.min(stops.length - 1, i + 1))} disabled={last} aria-label="Next stop">Next ›</button>
          <button type="button" className="voyage-exit" onClick={onExit} aria-label="End voyage">✕ End</button>
        </div>
        <div className="voyage-progress">
          {stops.map((s, i) => (
            <span key={`${s.kind}-${s.id ?? i}`} className={`voyage-dot${i === index ? " active" : ""}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
