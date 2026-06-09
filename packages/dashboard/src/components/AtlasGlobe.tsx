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
  if (!webglAvailable()) {
    return (
      <div className="atlas-globe-fallback" data-testid="atlas-globe-fallback">
        <p className="atlas-fallback-note">3D globe unavailable — showing the outline.</p>
        <AtlasOutline view={view} selectedId={selectedId} onSelect={onSelect} />
      </div>
    );
  }
  return (
    <div className="atlas-globe" data-testid="atlas-globe">
      <GlobeImpl view={view} onSelect={onSelect} />
    </div>
  );
}
