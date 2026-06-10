import { useEffect, useRef, useState } from "react";
import { AtlasOutline } from "./AtlasOutline";
import { AltitudeBadge } from "./AltitudeBadge";
import { webglAvailable, GlobeImpl } from "./globeImpl";
import type { AtlasView } from "../adapters/atlas";

export function AtlasGlobe({
  view,
  selectedId,
  onSelect,
}: {
  view: AtlasView;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Size the globe to its grid track, capped by the viewport so the stage
  // dominates the screen without pushing the altitude rail below the fold.
  // Inside a fullscreen stage (native or the CSS fallback) the cap is the
  // whole screen instead.
  const [size, setSize] = useState({ w: 520, h: 420 });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth || 520;
      const fs = (document.fullscreenElement?.contains(el) ?? false) || el.closest(".stage-fullscreen") != null;
      const maxH = fs ? window.innerHeight - 24 : Math.max(420, window.innerHeight - 300);
      setSize({ w, h: Math.min(Math.round(w * 0.82), maxH) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    document.addEventListener("fullscreenchange", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      document.removeEventListener("fullscreenchange", measure);
    };
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
      <GlobeImpl view={view} selectedId={selectedId} onSelect={onSelect} width={size.w} height={size.h} />
      <AltitudeBadge view={view} selectedId={selectedId} />
    </div>
  );
}

export default AtlasGlobe;
