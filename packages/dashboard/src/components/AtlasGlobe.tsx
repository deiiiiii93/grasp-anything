import { useEffect, useRef, useState } from "react";
import { AtlasOutline } from "./AtlasOutline";
import { webglAvailable, GlobeImpl } from "./globeImpl";
import type { AtlasView } from "../adapters/atlas";

export function AtlasGlobe({
  view,
  selectedId,
  onSelect,
}: {
  view: AtlasView;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Size the globe to its grid track so the canvas never overflows into the
  // detail column. Re-measure on resize.
  const [size, setSize] = useState({ w: 520, h: 420 });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth || 520;
      setSize({ w, h: Math.round(w * 0.82) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!webglAvailable()) {
    return (
      <div className="atlas-globe-fallback" data-testid="atlas-globe-fallback">
        <p className="atlas-fallback-note">3D globe unavailable — showing the outline.</p>
        <AtlasOutline view={view} selectedId={selectedId} onSelect={onSelect} />
      </div>
    );
  }
  return (
    <div className="atlas-globe" data-testid="atlas-globe" ref={containerRef}>
      <GlobeImpl view={view} onSelect={onSelect} width={size.w} height={size.h} />
    </div>
  );
}
