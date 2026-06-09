import { useEffect, useRef } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import type { AtlasView } from "../adapters/atlas";
import { selectionContext, visibleAt } from "../adapters/atlas";

export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

// Camera altitude per level — the literal altitude ladder Orbit→Continent→City→Landmark.
const ALT = { 1: 2.4, 2: 1.3, 3: 0.6, 4: 0.32 } as const;

export function GlobeImpl({
  view,
  selectedId,
  onSelect,
  width,
  height,
}: {
  view: AtlasView;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  width: number;
  height: number;
}) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  // One <button> billboard per continent, positioned/faded each frame via refs.
  const markRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Latest selection, read inside the rAF loop without restarting it.
  const selRef = useRef(selectedId);
  selRef.current = selectedId;

  const ctx = selectionContext(view, selectedId);

  // Level-of-detail: cities at Continent altitude (only the focused continent once
  // we've dived), landmarks at City altitude (only the focused city). Flow arcs ride
  // with landmarks, scoped to the focused continent.
  const points = [
    ...(visibleAt("city", ctx.level)
      ? view.cities.filter((c) => !ctx.continentId || c.continentId === ctx.continentId)
      : []
    ).map((c) => ({ id: c.id, lat: c.lat, lng: c.lng, color: c.color, r: 0.3 })),
    ...(visibleAt("landmark", ctx.level)
      ? view.landmarks.filter((l) => !ctx.cityId || l.cityId === ctx.cityId)
      : []
    ).map((l) => ({ id: l.id, lat: l.lat, lng: l.lng, color: l.color, r: 0.18 })),
  ];
  const arcs = visibleAt("arc", ctx.level)
    ? view.arcs.filter((a) => a.continentId === ctx.continentId)
    : [];

  // Fly the camera whenever the selection changes; idle-rotate only at orbit.
  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    if (ctx.lat != null && ctx.lng != null) {
      g.pointOfView({ lat: ctx.lat, lng: ctx.lng, altitude: ALT[ctx.level] }, 900);
      g.controls().autoRotate = false;
    } else {
      g.pointOfView({ lat: 18, lng: 45, altitude: ALT[1] }, 900);
      g.controls().autoRotate = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, view]);

  // Sprite billboard positioning + far-side occlusion + dive-dimming (rAF, ref-driven).
  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    const o = g.getCoords(0, 0, 0);
    const R2 = o.x * o.x + o.y * o.y + o.z * o.z;
    const REF_DIST = Math.sqrt(R2) * 3.4;

    let raf = 0;
    const tick = () => {
      const cam = g.camera().position;
      const camDist = Math.hypot(cam.x, cam.y, cam.z) || REF_DIST;
      const sizePx = Math.max(34, Math.min(160, (REF_DIST / camDist) * 52));
      const live = selectionContext(view, selRef.current);
      view.continents.forEach((c, i) => {
        const el = markRefs.current[i];
        if (!el) return;
        const p = g.getCoords(c.lat, c.lng, 0);
        const front = p.x * cam.x + p.y * cam.y + p.z * cam.z > R2; // facing camera
        const s = g.getScreenCoords(c.lat, c.lng, 0);
        if (!front || !s) {
          el.style.opacity = "0";
          el.style.pointerEvents = "none";
          return;
        }
        // Dim non-focused continents once the user has dived past orbit.
        const dim = live.level >= 2 && live.continentId != null && c.id !== live.continentId;
        el.style.left = `${s.x}px`;
        el.style.top = `${s.y}px`;
        el.style.width = `${sizePx}px`;
        el.style.opacity = dim ? "0.15" : "1";
        el.style.pointerEvents = dim ? "none" : "auto";
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
        arcsData={arcs}
        arcStartLat="startLat"
        arcStartLng="startLng"
        arcEndLat="endLat"
        arcEndLng="endLng"
        arcColor={(a: object) => (a as { color: string }).color}
        arcStroke={0.5}
        arcDashLength={0.4}
        arcDashGap={0.2}
        arcDashAnimateTime={1800}
        arcAltitudeAutoScale={0.4}
        onArcClick={(a) => onSelect((a as { id: string }).id)}
        onGlobeClick={() => onSelect(null)}
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
