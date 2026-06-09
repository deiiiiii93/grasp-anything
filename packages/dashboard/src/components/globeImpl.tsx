import { useEffect, useRef } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import type { AtlasView } from "../adapters/atlas";
import type { AtlasDomain } from "@grasp/schema";

export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

// A real-world landmark glyph per domain — the playful motif that anchors each continent.
const MOTIF: Record<AtlasDomain, string> = {
  architecture: "🏯",
  modules: "🗼",
  workflows: "🗽",
  businessFlows: "🔺",
  techSelection: "🗿",
  uiUxTaste: "🎭",
};

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

  // Frame the globe and let it drift, for the "alive" orbit feel.
  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    g.pointOfView({ lat: 18, lng: 45, altitude: 2.4 });
    const controls = g.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.4;
  }, []);

  // Markers are pure-WebGL (labels = sprite text, points = surface dots) — no CSS
  // renderer, which keeps us clear of react-globe.gl's multi-three-instance crash.
  const labels = view.continents.map((c) => ({
    id: c.id, lat: c.lat, lng: c.lng, text: `${MOTIF[c.domain]} ${c.title}`, color: c.color,
  }));
  const points = [
    ...view.cities.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng, color: c.color, r: 0.32 })),
    ...view.landmarks.map((l) => ({ id: l.id, lat: l.lat, lng: l.lng, color: l.color, r: 0.2 })),
  ];

  return (
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
      labelsData={labels}
      labelLat="lat"
      labelLng="lng"
      labelText="text"
      labelColor="color"
      labelSize={1.1}
      labelDotRadius={0.35}
      labelResolution={2}
      onLabelClick={(l) => onSelect((l as { id: string }).id)}
    />
  );
}
