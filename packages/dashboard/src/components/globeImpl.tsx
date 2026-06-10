import type React from "react";
import { useEffect, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import type { AtlasView } from "../adapters/atlas";
import { selectionContext, visibleAt } from "../adapters/atlas";
import { buildBillboards, staggerOffsetPx, type BillboardTier } from "./billboards";

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

const OCEAN_URL = "./atlas/ocean.jpg";
const GLOBE_FALLBACK_URL = "./earth-dark.jpg"; // kept in public/ as the failure tier

// Warning tier: a missing sprite degrades to a colored dot; warn once per URL.
const warnedSprites = new Set<string>();
function spriteFailed(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  const url = img.getAttribute("src") ?? "";
  if (!warnedSprites.has(url)) {
    warnedSprites.add(url);
    console.warn(`atlas sprite missing: ${url}`);
  }
  img.closest(".atlas-bb")?.classList.add("atlas-bb-broken");
}

// Per-tier billboard size: px = clamp(ratio * mult, min, max), ratio = REF_DIST/camDist.
const TIER_SCALE: Record<BillboardTier, { mult: number; min: number; max: number }> = {
  continent: { mult: 52, min: 34, max: 160 },
  city: { mult: 20, min: 28, max: 64 },
  landmark: { mult: 12, min: 18, max: 36 },
};

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
  // One <button> billboard per visible marker, positioned/faded each frame via refs.
  const markRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const ctx = selectionContext(view, selectedId);
  const billboards = buildBillboards(view, ctx);

  // Failure tier: probe the ocean texture once; a 404 must not leave a bare sphere.
  const [globeUrl, setGlobeUrl] = useState(OCEAN_URL);
  useEffect(() => {
    const probe = new Image();
    probe.onerror = () => setGlobeUrl(GLOBE_FALLBACK_URL);
    probe.src = OCEAN_URL;
  }, []);

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
    return rgba(cont.color, dim ? 0.08 : 0.55);
  };

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
      g.pointOfView({ lat: 18, lng: 45, altitude: ALT[1] }, 900);
      g.controls().autoRotate = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, view]);

  // Billboard positioning: screen coords + far-side occlusion + per-tier size +
  // dim/staging rules. rAF + direct style writes; no React state per frame.
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
      const ratio = REF_DIST / camDist;
      for (const b of billboards) {
        const el = markRefs.current.get(b.id);
        if (!el) continue;
        const p = g.getCoords(b.lat, b.lng, 0);
        const front = p.x * cam.x + p.y * cam.y + p.z * cam.z > R2; // facing camera
        const s = g.getScreenCoords(b.lat, b.lng, 0);
        if (!front || !s) {
          el.style.opacity = "0";
          el.style.pointerEvents = "none";
          continue;
        }
        const t = TIER_SCALE[b.tier];
        let sizePx = Math.max(t.min, Math.min(t.max, ratio * t.mult));
        let opacity = 1;
        // Dim non-focused continents once the user has dived past orbit.
        if (b.tier === "continent" && ctx.level >= 2 && ctx.continentId != null && b.id !== ctx.continentId)
          opacity = 0.15;
        // Figure/ground inversion: at Landmark altitude the focused city recedes.
        if (b.tier === "city" && ctx.level === 4 && b.id === ctx.cityId) {
          sizePx *= 0.6;
          opacity = 0.45;
        }
        el.style.left = `${s.x}px`;
        el.style.top = `${s.y}px`;
        el.style.width = `${sizePx}px`;
        el.style.opacity = String(opacity);
        el.style.pointerEvents = opacity < 0.2 ? "none" : "auto";
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selectedId]);

  return (
    <div style={{ position: "relative", width, height }}>
      <Globe
        ref={globeRef}
        width={width}
        height={height}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl={globeUrl}
        atmosphereColor="#4a7fd6"
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
      {/* Billboard overlay — DOM, no three.js import. One button per visible marker. */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {billboards.map((b) => (
          <button
            key={b.id}
            ref={(el) => {
              if (el) markRefs.current.set(b.id, el);
              else markRefs.current.delete(b.id);
            }}
            type="button"
            className={`atlas-bb atlas-bb-${b.tier}`}
            data-testid={`bb-${b.id}`}
            title={b.title}
            onClick={() => onSelect(b.id)}
            style={{ zIndex: selectedId === b.id ? 2 : 1, "--bb-color": b.color } as React.CSSProperties}
          >
            <img className="atlas-bb-img" src={b.spriteUrl} alt={b.label} draggable={false} onError={spriteFailed} />
            <span
              className="atlas-bb-label"
              style={
                {
                  color: b.tier === "landmark" ? undefined : b.color,
                  "--stagger": `${staggerOffsetPx(b)}px`,
                } as React.CSSProperties
              }
            >
              {b.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
