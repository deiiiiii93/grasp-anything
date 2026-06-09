import Globe from "react-globe.gl";
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
}: {
  view: AtlasView;
  onSelect: (id: string) => void;
}) {
  const points = [
    ...view.cities.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng, color: c.color, r: 0.4 })),
    ...view.landmarks.map((l) => ({ id: l.id, lat: l.lat, lng: l.lng, color: l.color, r: 0.25 })),
  ];
  const labels = view.continents.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng, text: `${c.title} · ${c.continentName}`, color: c.color }));
  return (
    <Globe
      width={620}
      height={460}
      backgroundColor="#0c0e12"
      pointsData={points}
      pointLat="lat"
      pointLng="lng"
      pointColor="color"
      pointAltitude={0.02}
      pointRadius="r"
      onPointClick={(p) => onSelect((p as { id: string }).id)}
      labelsData={labels}
      labelLat="lat"
      labelLng="lng"
      labelText="text"
      labelColor="color"
      labelSize={1.4}
      onLabelClick={(l) => onSelect((l as { id: string }).id)}
    />
  );
}
