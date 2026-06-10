import { useEffect, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import type { AtlasView } from "../adapters/atlas";
import { selectionContext, visibleAt } from "../adapters/atlas";

// Slimmed Natural Earth feature: one property, the continent name.
interface WorldFeature {
  type: "Feature";
  properties: { continent: string };
  geometry: object;
}

// #rrggbb → rgba(...). The tint alphas keep the dark earth texture visible.
function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
const UNCHARTED = "#5b6470"; // Antarctica & open-ocean territories

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

  // Tinted continent landmass (Natural Earth, slimmed to { continent }).
  const [world, setWorld] = useState<WorldFeature[]>([]);
  useEffect(() => {
    let alive = true;
    fetch("./atlas/world.geojson")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((g: { features: WorldFeature[] }) => { if (alive) setWorld(g.features); })
      .catch(() => {}); // polygons are decoration; the globe works without them
    return () => { alive = false; };
  }, []);

  // continentName ("Asia") → its continent view, for tints and polygon clicks.
  const contByName = new Map(view.continents.map((c) => [c.continentName, c]));
  const polygonCap = (f: object) => {
    const cont = contByName.get((f as WorldFeature).properties.continent);
    if (!cont) return rgba(UNCHARTED, 0.25);
    const dim = ctx.level >= 2 && ctx.continentId != null && cont.id !== ctx.continentId;
    return rgba(cont.color, dim ? 0.08 : 0.42);
  };

  // Level-of-detail: cities at Continent altitude (only the focused continent once
  // we've dived), landmarks at City altitude (only the focused city). Both render
  // as NAMED labels (dot + text) so the network reads like a real map.
  const labels = [
    ...(visibleAt("city", ctx.level)
      ? view.cities.filter((c) => !ctx.continentId || c.continentId === ctx.continentId)
      : []
    ).map((c) => ({
      id: c.id, lat: c.lat, lng: c.lng, color: c.color,
      text: c.anchorName ? `${c.name} · ${c.anchorName}` : c.name,
      size: 0.95, dot: 0.42,
    })),
    ...(visibleAt("landmark", ctx.level)
      ? view.landmarks.filter((l) => !ctx.cityId || l.cityId === ctx.cityId)
      : []
    ).map((l) => ({ id: l.id, lat: l.lat, lng: l.lng, color: l.color, text: l.name, size: 0.6, dot: 0.24 })),
  ];
  // Flow arcs are continent-wide; hierarchy spokes follow the landmark filter
  // (only the focused city's spokes once the camera is at City altitude).
  const arcs = visibleAt("arc", ctx.level)
    ? view.arcs.filter((a) =>
        a.continentId === ctx.continentId &&
        (a.kind === "flow" || !ctx.cityId || a.sourceId === ctx.cityId))
    : [];

  // Fly the camera whenever the selection changes; idle-rotate only at orbit.
  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    if (ctx.lat != null && ctx.lng != null) {
      g.pointOfView({ lat: ctx.lat, lng: ctx.lng, altitude: ALT[ctx.level] }, 900);
      g.controls().autoRotate = false;
    } else {
      g.pointOfView({ lat: 18, lng: 15, altitude: ALT[1] }, 900);
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
        polygonsData={world}
        polygonCapColor={polygonCap}
        polygonSideColor={() => "rgba(0,0,0,0)"}
        polygonStrokeColor={() => "rgba(255,255,255,0.18)"}
        polygonAltitude={0.005}
        onPolygonClick={(f) => {
          const cont = contByName.get((f as WorldFeature).properties.continent);
          if (cont) onSelect(cont.id);
        }}
        labelsData={labels}
        labelLat="lat"
        labelLng="lng"
        labelText="text"
        labelSize="size"
        labelDotRadius="dot"
        labelColor={(l: object) => (l as { color: string }).color}
        labelAltitude={0.008}
        labelResolution={2}
        onLabelClick={(l) => onSelect((l as { id: string }).id)}
        arcsData={arcs}
        arcStartLat="startLat"
        arcStartLng="startLng"
        arcEndLat="endLat"
        arcEndLng="endLng"
        arcColor={(a: object) => {
          const arc = a as { kind: string; color: string };
          return arc.kind === "spoke" ? `${arc.color}88` : arc.color;
        }}
        arcStroke={(a: object) => ((a as { kind: string }).kind === "spoke" ? 0.22 : 0.5)}
        arcDashLength={(a: object) => ((a as { kind: string }).kind === "spoke" ? 1 : 0.4)}
        arcDashGap={(a: object) => ((a as { kind: string }).kind === "spoke" ? 0 : 0.2)}
        arcDashAnimateTime={(a: object) => ((a as { kind: string }).kind === "spoke" ? 0 : 1800)}
        arcAltitudeAutoScale={(a: object) => ((a as { kind: string }).kind === "spoke" ? 0.18 : 0.4)}
        onArcClick={(a) => onSelect((a as { targetId: string }).targetId)}
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
