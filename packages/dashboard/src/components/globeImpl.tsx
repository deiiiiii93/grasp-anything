import { useEffect, useRef } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import type { AtlasView } from "../adapters/atlas";

export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

export function GlobeImpl({
  view,
  onSelect,
  width,
  height,
}: {
  view: AtlasView;
  onSelect: (id: string) => void;
  width: number;
  height: number;
}) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  // One <button> billboard per continent, positioned/faded each frame via refs
  // (no setState — the rAF loop mutates style directly).
  const markRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // City/landmark surface dots stay as a pure-WebGL points layer.
  const points = [
    ...view.cities.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng, color: c.color, r: 0.3 })),
    ...view.landmarks.map((l) => ({ id: l.id, lat: l.lat, lng: l.lng, color: l.color, r: 0.18 })),
  ];

  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    g.pointOfView({ lat: 18, lng: 45, altitude: 2.4 });
    const controls = g.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.4;

    // Derive the globe radius² in three-space (globe.gl uses 100; derive to be safe).
    const o = g.getCoords(0, 0, 0);
    const R2 = o.x * o.x + o.y * o.y + o.z * o.z;
    const REF_DIST = Math.sqrt(R2) * 3.4; // camera distance at altitude 2.4

    let raf = 0;
    const tick = () => {
      const cam = g.camera().position;
      const camDist = Math.hypot(cam.x, cam.y, cam.z) || REF_DIST;
      const sizePx = Math.max(34, Math.min(160, (REF_DIST / camDist) * 52));
      view.continents.forEach((c, i) => {
        const el = markRefs.current[i];
        if (!el) return;
        const p = g.getCoords(c.lat, c.lng, 0);
        // A surface point faces the camera iff dot(P, camPos) > R².
        const front = p.x * cam.x + p.y * cam.y + p.z * cam.z > R2;
        const s = g.getScreenCoords(c.lat, c.lng, 0);
        if (!front || !s) {
          el.style.opacity = "0";
          el.style.pointerEvents = "none";
          return;
        }
        el.style.left = `${s.x}px`;
        el.style.top = `${s.y}px`;
        el.style.width = `${sizePx}px`;
        el.style.opacity = "1";
        el.style.pointerEvents = "auto";
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [view]);

  return (
    <div style={{ position: "relative", width, height }}>
      <Globe
        ref={globeRef}
        width={width}
        height={height}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl="./earth-dark.jpg"
        atmosphereColor="#5aa9f0"
        atmosphereAltitude={0.18}
        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointColor="color"
        pointAltitude={0.006}
        pointRadius="r"
        pointsMerge={false}
        onPointClick={(p) => onSelect((p as { id: string }).id)}
      />
      {/* Landmark sprite billboards — DOM overlay (no three.js import). */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {view.continents.map((c, i) => (
          <button
            key={c.id}
            ref={(el) => {
              markRefs.current[i] = el;
            }}
            type="button"
            className="atlas-sprite"
            title={c.title}
            onClick={() => onSelect(c.id)}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              opacity: 0,
              transform: "translate(-50%, -60%)",
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
            }}
          >
            <img
              src={`./atlas/landmarks/${c.domain}.png`}
              alt={c.title}
              draggable={false}
              style={{
                width: "100%",
                height: "auto",
                display: "block",
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.55))",
              }}
            />
            <span
              style={{
                display: "block",
                textAlign: "center",
                marginTop: "-2px",
                fontSize: "11px",
                fontWeight: 600,
                color: c.color,
                textShadow: "0 1px 3px rgba(0,0,0,0.9)",
                whiteSpace: "nowrap",
              }}
            >
              {c.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
