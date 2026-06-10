# Atlas Marker Hierarchy + Ambiance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make cities and landmarks visually distinct tiers on the Atlas globe via a gpt-image-2 sprite family (12 sprites + ocean texture + compass), one generalized DOM billboard system, and typographic tiering.

**Architecture:** globe.gl `labelsData` is retired for cities/landmarks. A pure builder (`billboards.ts`) maps `AtlasView` + `SelectionContext` to billboard models; `globeImpl.tsx` renders them as `<button>` billboards positioned by the existing rAF loop, generalized to three tiers with per-tier size clamps. The adapter gains one field (`domain`) — all sprite paths, casing, and pixels stay renderer-side. Ambiance: a geography-free ocean texture (Natural Earth polygons remain the land) + compass rose.

**Tech Stack:** React 18 + react-globe.gl, Vitest + Testing Library (jsdom), ZenMux `openai/gpt-image-2`, ImageMagick.

**Spec:** `docs/superpowers/specs/2026-06-10-atlas-marker-hierarchy-design.md`
**Branch:** `atlas-voyage`

**File map:**

| File | Role |
|---|---|
| `packages/dashboard/atlas-sprite-src/` (gitignored) | 1024² masters, raws, helper script |
| `packages/dashboard/public/atlas/cities/{domain}.png` | 6 city emblems (new) |
| `packages/dashboard/public/atlas/pins/{domain}.png` | 6 landmark pins (new) |
| `packages/dashboard/public/atlas/ocean.jpg`, `compass.png` | ambiance (new) |
| `packages/dashboard/src/adapters/atlas.ts` | add `domain` to CityView/LandmarkView |
| `packages/dashboard/src/components/billboards.ts` | NEW pure billboard builder |
| `packages/dashboard/src/components/billboards.test.ts` | NEW |
| `packages/dashboard/src/components/globeImpl.tsx` | billboard rendering + ambiance |
| `packages/dashboard/src/components/globeImpl.test.tsx` | NEW (react-globe.gl mocked) |
| `packages/dashboard/src/index.css` | `.atlas-bb*`, `.atlas-compass` rules |

**Commands** (run from repo root):
- All dashboard tests: `npm run test -w packages/dashboard`
- One file: `npm run test -w packages/dashboard -- src/components/billboards.test.ts`
- Typecheck: `npm run typecheck -w packages/dashboard`

---

## Phase A — Assets

### Task 1: Generate the 12 sprites

**Files:**
- Create: `packages/dashboard/atlas-sprite-src/zenmux_img.py` (gitignored dir)
- Create: `packages/dashboard/atlas-sprite-src/generate-tiers.sh`
- Create: `packages/dashboard/public/atlas/cities/{architecture,modules,workflows,businessFlows,techSelection,uiUxTaste}.png`
- Create: `packages/dashboard/public/atlas/pins/{architecture,modules,workflows,businessFlows,techSelection,uiUxTaste}.png`

- [ ] **Step 1: Write the generation helper** (the zenmux skill CLI is text-only — no image command)

`packages/dashboard/atlas-sprite-src/zenmux_img.py`:

```python
#!/usr/bin/env python3
# Minimal ZenMux gpt-image-2 helper: prompt -> PNG. Usage: zenmux_img.py "<prompt>" out.png [WxH]
import base64, json, os, sys, urllib.request

prompt, out = sys.argv[1], sys.argv[2]
size = sys.argv[3] if len(sys.argv) > 3 else "1024x1024"
req = urllib.request.Request(
    "https://zenmux.ai/api/v1/images/generations",
    data=json.dumps({"model": "openai/gpt-image-2", "prompt": prompt,
                     "size": size, "quality": "high"}).encode(),
    headers={"Authorization": f"Bearer {os.environ['ZENMUX_API_KEY']}",
             "Content-Type": "application/json"},
)
with urllib.request.urlopen(req, timeout=300) as r:
    b64 = json.load(r)["data"][0]["b64_json"]
with open(out, "wb") as f:
    f.write(base64.b64decode(b64))
print(out)
```

The API key is NOT in the non-interactive shell env. Load it per command:
`eval "$(grep '^[[:space:]]*export ZENMUX_API_KEY=' ~/.zshrc | tail -1)"`

- [ ] **Step 2: Write the batch script with the 12 prompts**

Style must match the existing continent dioramas (low-poly isometric, warm rim
light in the continent tint). Tier signatures: cities stand on a circular disc
base (no floating island — that's the continent signature); landmarks are one
bare object, bold silhouette.

`packages/dashboard/atlas-sprite-src/generate-tiers.sh`:

```bash
#!/usr/bin/env bash
# Generates 1024^2 masters into ./raw, keys them into ./keyed, ships 512^2 PNGs.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p raw keyed ../public/atlas/cities ../public/atlas/pins

CITY_STYLE="low-poly isometric 3D game-art miniature, standing on a small round stone disc base, warm rim light tinted %s, centered, flat solid dark slate #232830 background, no text, no extra scenery"
PIN_STYLE="a single low-poly 3D object, bold simple silhouette readable at small size, minimal facets, no base, no scenery, warm rim light tinted %s, centered, flat solid dark slate #232830 background, no text"

declare -a SPECS=(
  "architecture|#e5687a|an ornate Chinese pagoda gate|a glazed ceramic brick"
  "modules|#b794f6|a European clocktower|a brass cog wheel"
  "workflows|#5aa9f0|a tiny North American skyline cluster of towers|a lit torch"
  "businessFlows|#f5c451|a mud-brick citadel with rounded towers|an engraved stone tablet"
  "techSelection|#5bd1a0|a terraced hillside town with stone steps|a precisely cut ashlar stone block"
  "uiUxTaste|#f0974a|a white sail pavilion by the water|a nautilus shell"
)

for spec in "${SPECS[@]}"; do
  IFS='|' read -r domain tint city pin <<<"$spec"
  python3 zenmux_img.py "$city, $(printf "$CITY_STYLE" "$tint")" "raw/city_${domain}.png"
  python3 zenmux_img.py "$pin, $(printf "$PIN_STYLE" "$tint")"  "raw/pin_${domain}.png"
done

for f in raw/*.png; do
  base=$(basename "$f" .png)
  magick "$f" -alpha set -fuzz 14% -fill none \
    -draw "alpha 0,0 floodfill"    -draw "alpha 1023,0 floodfill" \
    -draw "alpha 0,1023 floodfill" -draw "alpha 1023,1023 floodfill" \
    "keyed/${base}.png"
done

for d in architecture modules workflows businessFlows techSelection uiUxTaste; do
  magick "keyed/city_${d}.png" -resize 512x512 "../public/atlas/cities/${d}.png"
  magick "keyed/pin_${d}.png"  -resize 512x512 "../public/atlas/pins/${d}.png"
done
```

- [ ] **Step 3: Run it**

```bash
eval "$(grep '^[[:space:]]*export ZENMUX_API_KEY=' ~/.zshrc | tail -1)"
bash packages/dashboard/atlas-sprite-src/generate-tiers.sh
```

Expected: 12 PNGs in `raw/`, `keyed/`, and 12 shipped files under
`public/atlas/cities/` and `public/atlas/pins/`.

- [ ] **Step 4: Visually inspect every keyed sprite** (Read each
`public/atlas/{cities,pins}/*.png`). Regenerate any sprite that fails:
muddy silhouette, floating-island base on a city, scenery around a pin, or
keying that ate the subject (if so, regenerate that one on a lighter
background and re-key). Pins must read at 28 px — view them small.

### Task 2: Ocean texture + compass rose

**Files:**
- Create: `packages/dashboard/public/atlas/ocean.jpg`
- Create: `packages/dashboard/public/atlas/compass.png`

- [ ] **Step 1: Generate the geography-free ocean** (the tinted Natural Earth
polygons remain the land; the texture must contain NO landmasses)

```bash
cd packages/dashboard/atlas-sprite-src
python3 zenmux_img.py "dark antique night-atlas ocean map texture, deep ink-blue water, very faint thin gold rhumb lines radiating from a few small compass points, scattered tiny dim stars, subtle parchment grain, uniform tone edge to edge, no land, no continents, no islands, no coastlines, no text, muted and dark" raw/ocean.png 1536x1024
magick raw/ocean.png -resize '2048x1024!' -quality 85 ../public/atlas/ocean.jpg
```

(Stretching to 2:1 equirectangular is fine — there is no geography to distort.)

- [ ] **Step 2: Generate and key the compass rose**

```bash
python3 zenmux_img.py "an antique compass rose, gold and ink-blue, flat top-down view, bold simple silhouette, low-poly game-art style, centered, flat solid dark slate #232830 background, no text" raw/compass.png
magick raw/compass.png -alpha set -fuzz 14% -fill none \
  -draw "alpha 0,0 floodfill" -draw "alpha 1023,0 floodfill" \
  -draw "alpha 0,1023 floodfill" -draw "alpha 1023,1023 floodfill" \
  keyed/compass.png
magick keyed/compass.png -resize 256x256 ../public/atlas/compass.png
```

- [ ] **Step 3: Inspect both** (Read the files; ocean must be land-free and
dark enough that gold/colored labels stay readable on it).

### Task 3: Contact sheet → USER GATE → commit assets

- [ ] **Step 1: Build the contact sheet**

```bash
cd packages/dashboard/public/atlas
magick montage cities/architecture.png pins/architecture.png cities/modules.png pins/modules.png \
  cities/workflows.png pins/workflows.png cities/businessFlows.png pins/businessFlows.png \
  cities/techSelection.png pins/techSelection.png cities/uiUxTaste.png pins/uiUxTaste.png \
  -tile 4x3 -geometry 256x256+10+10 -background '#11151c' /tmp/atlas-contact-sheet.png
```

- [ ] **Step 2: STOP — show the contact sheet + ocean + compass to the user.**
This is the Phase A acceptance gate from the spec. Do not proceed to Phase B
until the user approves; regenerate rejected sprites and re-gate.

- [ ] **Step 3: Commit approved assets**

```bash
git add packages/dashboard/public/atlas
git commit -m "feat(atlas): city/pin sprite family, ocean texture, compass rose (gpt-image-2)"
```

---

## Phase B — Billboard system

### Task 4: Adapter — `domain` on CityView and LandmarkView

**Files:**
- Modify: `packages/dashboard/src/adapters/atlas.ts`
- Test: `packages/dashboard/src/adapters/atlas.test.ts`

- [ ] **Step 1: Write the failing test** (append inside the existing top-level
`describe` in `atlas.test.ts`, matching its style):

```ts
it("cities and landmarks carry their continent's domain (renderer maps domain → sprite)", () => {
  const view = buildAtlasView(sampleDoc);
  const city = view.cities.find((c) => c.id === "city_core");
  expect(city?.domain).toBe("architecture");
  const lm = view.landmarks.find((l) => l.id === "lm_validator");
  expect(lm?.domain).toBe("architecture");
});
```

- [ ] **Step 2: Run it — expect FAIL** (TS error / `undefined`):
`npm run test -w packages/dashboard -- src/adapters/atlas.test.ts`

- [ ] **Step 3: Implement.** In `atlas.ts`:
  - `CityView`: add `domain: AtlasDomain;` after `continentId: string;`
  - `LandmarkView`: add `domain: AtlasDomain;` after `continentId: string;`
  - In `buildAtlasView`, the `cities.push({ id: city.id, continentId: cont.id, ...` call gains `domain: cont.domain,` and the `landmarks.push({ id: lm.id, cityId: city.id, continentId: cont.id, ...` call gains `domain: cont.domain,`.

- [ ] **Step 4: Run — expect PASS**, then typecheck:
`npm run typecheck -w packages/dashboard`

- [ ] **Step 5: Commit**

```bash
git add packages/dashboard/src/adapters/atlas.ts packages/dashboard/src/adapters/atlas.test.ts
git commit -m "feat(atlas): expose domain on city/landmark views for sprite mapping"
```

### Task 5: Pure billboard builder

**Files:**
- Create: `packages/dashboard/src/components/billboards.ts`
- Test: `packages/dashboard/src/components/billboards.test.ts`

- [ ] **Step 1: Write the failing tests** — `billboards.test.ts`:

```ts
import { buildBillboards, staggerOffsetPx } from "./billboards";
import { buildAtlasView, selectionContext } from "../adapters/atlas";
import { sampleDoc } from "../test-utils/sample";

const view = buildAtlasView(sampleDoc);

describe("buildBillboards", () => {
  it("orbit level: only continent billboards, with the diorama sprites", () => {
    const bbs = buildBillboards(view, selectionContext(view, null));
    expect(bbs).toHaveLength(view.continents.length);
    expect(bbs.every((b) => b.tier === "continent")).toBe(true);
    expect(bbs.find((b) => b.id === "c_arch")?.spriteUrl).toBe("./atlas/landmarks/architecture.png");
  });

  it("continent selected: adds only that continent's cities, with emblem sprites and anchored labels", () => {
    const bbs = buildBillboards(view, selectionContext(view, "c_arch"));
    const cities = bbs.filter((b) => b.tier === "city");
    expect(cities.length).toBeGreaterThan(0);
    expect(cities.every((b) => b.spriteUrl === "./atlas/cities/architecture.png")).toBe(true);
    expect(cities.find((b) => b.id === "city_core")?.label).toBe("Deterministic core · Beijing");
    expect(bbs.some((b) => b.tier === "landmark")).toBe(false);
  });

  it("city selected: adds its landmarks with pin sprites and per-city stagger indices", () => {
    const bbs = buildBillboards(view, selectionContext(view, "city_core"));
    const lms = bbs.filter((b) => b.tier === "landmark");
    expect(lms.map((b) => b.id)).toEqual(["lm_validator", "lm_assemble"]);
    expect(lms.every((b) => b.spriteUrl === "./atlas/pins/architecture.png")).toBe(true);
    expect(lms.map((b) => b.staggerIndex)).toEqual([0, 1]);
  });
});

describe("staggerOffsetPx", () => {
  it("alternates above/below and widens every pair: -12, +12, -20, +20", () => {
    const mk = (i: number) =>
      ({ tier: "landmark", staggerIndex: i } as Parameters<typeof staggerOffsetPx>[0]);
    expect([0, 1, 2, 3].map((i) => staggerOffsetPx(mk(i)))).toEqual([-12, 12, -20, 20]);
    expect(staggerOffsetPx({ tier: "city", staggerIndex: 0 } as Parameters<typeof staggerOffsetPx>[0])).toBe(0);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (module not found):
`npm run test -w packages/dashboard -- src/components/billboards.test.ts`

- [ ] **Step 3: Implement** — `billboards.ts`:

```ts
import type { AtlasView, SelectionContext } from "../adapters/atlas";
import { visibleAt } from "../adapters/atlas";

export type BillboardTier = "continent" | "city" | "landmark";

// One positioned marker on the globe overlay. Pure data: the rAF loop and CSS
// decide pixels; this module decides WHAT is visible and WHICH sprite it wears.
export interface Billboard {
  id: string;
  tier: BillboardTier;
  lat: number;
  lng: number;
  spriteUrl: string;
  label: string;
  color: string;
  /** landmark's index within its city (drives the label stagger); 0 elsewhere */
  staggerIndex: number;
  title: string; // hover text
}

// Deterministic label collision-avoidance: alternate above/below the pin and
// widen every pair: -12, +12, -20, +20, ...
export function staggerOffsetPx(b: Pick<Billboard, "tier" | "staggerIndex">): number {
  if (b.tier !== "landmark") return 0;
  const i = b.staggerIndex;
  return (i % 2 === 0 ? -1 : 1) * (12 + 8 * Math.floor(i / 2));
}

// Same LOD + focus-filter rules the labelsData path used: cities appear at
// Continent altitude (focused continent only once dived), landmarks at City
// altitude (focused city only).
export function buildBillboards(view: AtlasView, ctx: SelectionContext): Billboard[] {
  const continents: Billboard[] = view.continents.map((c) => ({
    id: c.id, tier: "continent", lat: c.lat, lng: c.lng,
    spriteUrl: `./atlas/landmarks/${c.domain}.png`,
    label: c.title, color: c.color, staggerIndex: 0, title: c.title,
  }));
  const cities: Billboard[] = (visibleAt("city", ctx.level)
    ? view.cities.filter((c) => !ctx.continentId || c.continentId === ctx.continentId)
    : []
  ).map((c) => ({
    id: c.id, tier: "city", lat: c.lat, lng: c.lng,
    spriteUrl: `./atlas/cities/${c.domain}.png`,
    label: c.anchorName ? `${c.name} · ${c.anchorName}` : c.name,
    color: c.color, staggerIndex: 0, title: c.summary || c.name,
  }));
  const perCity = new Map<string, number>();
  const landmarks: Billboard[] = (visibleAt("landmark", ctx.level)
    ? view.landmarks.filter((l) => !ctx.cityId || l.cityId === ctx.cityId)
    : []
  ).map((l) => {
    const i = perCity.get(l.cityId) ?? 0;
    perCity.set(l.cityId, i + 1);
    return {
      id: l.id, tier: "landmark" as const, lat: l.lat, lng: l.lng,
      spriteUrl: `./atlas/pins/${l.domain}.png`,
      label: l.name, color: l.color, staggerIndex: i,
      title: l.whyItMatters || l.name,
    };
  });
  return [...continents, ...cities, ...landmarks];
}
```

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add packages/dashboard/src/components/billboards.ts packages/dashboard/src/components/billboards.test.ts
git commit -m "feat(atlas): pure billboard builder — 3-tier LOD, sprites, label stagger"
```

### Task 6: globeImpl — render billboards, retire labels, generalize the rAF loop

**Files:**
- Modify: `packages/dashboard/src/components/globeImpl.tsx`
- Modify: `packages/dashboard/src/index.css`
- Test: `packages/dashboard/src/components/globeImpl.test.tsx` (NEW)

- [ ] **Step 1: Write the failing tests** — `globeImpl.test.tsx`. globeImpl has
never been tested directly (it's mocked elsewhere because jsdom lacks WebGL);
here we mock `react-globe.gl` instead — the billboard overlay is plain DOM:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { buildAtlasView } from "../adapters/atlas";
import { sampleDoc } from "../test-utils/sample";

const captured = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }));
vi.mock("react-globe.gl", async () => {
  const { forwardRef } = await import("react");
  return {
    default: forwardRef(function MockGlobe(props: Record<string, unknown>, _ref: unknown) {
      captured.props = props;
      return null;
    }),
  };
});

import { GlobeImpl } from "./globeImpl";

const view = buildAtlasView(sampleDoc);
const noop = () => {};

beforeEach(() => {
  captured.props = null;
  // world.geojson fetch stays in flight; polygons are decoration.
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
});
afterEach(() => vi.unstubAllGlobals());

describe("GlobeImpl billboards", () => {
  it("renders sprite billboards for all three tiers when a city is selected", () => {
    render(<GlobeImpl view={view} selectedId="city_core" onSelect={noop} width={800} height={600} />);
    const cont = screen.getByTestId("bb-c_arch");
    expect(cont.className).toContain("atlas-bb-continent");
    expect(cont.querySelector("img")?.getAttribute("src")).toBe("./atlas/landmarks/architecture.png");
    const city = screen.getByTestId("bb-city_core");
    expect(city.className).toContain("atlas-bb-city");
    expect(city.querySelector("img")?.getAttribute("src")).toBe("./atlas/cities/architecture.png");
    const lm = screen.getByTestId("bb-lm_validator");
    expect(lm.className).toContain("atlas-bb-landmark");
    expect(lm.querySelector("img")?.getAttribute("src")).toBe("./atlas/pins/architecture.png");
  });

  it("landmark labels carry their deterministic stagger offset", () => {
    render(<GlobeImpl view={view} selectedId="city_core" onSelect={noop} width={800} height={600} />);
    const labels = ["bb-lm_validator", "bb-lm_assemble"].map(
      (id) => screen.getByTestId(id).querySelector(".atlas-bb-label") as HTMLElement,
    );
    expect(labels.map((l) => l.style.getPropertyValue("--stagger"))).toEqual(["-12px", "12px"]);
  });

  it("clicking a billboard bubbles its id via onSelect", () => {
    const onSelect = vi.fn();
    render(<GlobeImpl view={view} selectedId="city_core" onSelect={onSelect} width={800} height={600} />);
    fireEvent.click(screen.getByTestId("bb-lm_validator"));
    expect(onSelect).toHaveBeenCalledWith("lm_validator");
  });

  it("labelsData is retired — cities/landmarks no longer go through globe.gl labels", () => {
    render(<GlobeImpl view={view} selectedId="city_core" onSelect={noop} width={800} height={600} />);
    expect(captured.props).not.toBeNull();
    expect("labelsData" in (captured.props as object)).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (no `bb-*` testids; `labelsData` present):
`npm run test -w packages/dashboard -- src/components/globeImpl.test.tsx`

- [ ] **Step 3: Refactor `globeImpl.tsx`.** Changes, in full:

1. Imports: drop `visibleAt` from the adapter import (only `selectionContext`
   remains); add `import { buildBillboards, staggerOffsetPx, type BillboardTier } from "./billboards";`
2. Delete the whole `const labels = [...]` block and ALL `labels*`/`onLabelClick`
   props from `<Globe>` (`labelsData`, `labelLat`, `labelLng`, `labelText`,
   `labelSize`, `labelDotRadius`, `labelColor`, `labelAltitude`,
   `labelResolution`, `onLabelClick`). Arcs and polygons stay untouched.
3. Above the component, the per-tier size curve (one camera ratio, three clamps):

```ts
// Per-tier billboard size: px = clamp(ratio * mult, min, max), ratio = REF_DIST/camDist.
const TIER_SCALE: Record<BillboardTier, { mult: number; min: number; max: number }> = {
  continent: { mult: 52, min: 34, max: 160 },
  city: { mult: 20, min: 28, max: 64 },
  landmark: { mult: 12, min: 18, max: 36 },
};
```

4. Inside the component: `const billboards = buildBillboards(view, ctx);` and
   replace the index-array refs with an id-keyed map
   `const markRefs = useRef<Map<string, HTMLButtonElement>>(new Map());`
   (`selRef` is no longer needed — the rAF effect now restarts on selection
   because `billboards` changes with it).
5. Replace the rAF effect with the generalized loop:

```tsx
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
```

6. Replace the continent-only overlay JSX with the generic one (inline styles
   move to `.atlas-bb*` CSS; only per-billboard values stay inline):

```tsx
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
      <img className="atlas-bb-img" src={b.spriteUrl} alt={b.label} draggable={false} />
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
```

   (Add `import type React from "react";` if the `React.CSSProperties` cast
   needs it under `verbatimModuleSyntax`.)

7. CSS — append to `index.css` near the `.atlas-globe` rules:

```css
/* Billboard tiers: scene (continent) vs badge (city) vs object (landmark). */
.atlas-bb {
  position: absolute; left: 0; top: 0; opacity: 0;
  transform: translate(-50%, -60%);
  background: none; border: none; padding: 0; cursor: pointer;
}
.atlas-bb-img { width: 100%; height: auto; display: block; filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.55)); }
.atlas-bb-label {
  display: block; text-align: center; margin-top: -2px; font-size: 11px; font-weight: 600;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9); white-space: nowrap;
}
.atlas-bb-city .atlas-bb-label { text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; }
.atlas-bb-landmark .atlas-bb-label {
  color: #e8e6e0; font-size: 10px; font-weight: 500;
  transform: translateY(var(--stagger, 0px));
}
```

- [ ] **Step 4: Run the new file — expect PASS** — then the full suite and
typecheck (the old `.atlas-sprite` class is gone; nothing else referenced it):

```bash
npm run test -w packages/dashboard
npm run typecheck -w packages/dashboard
```

- [ ] **Step 5: Commit**

```bash
git add packages/dashboard/src/components/globeImpl.tsx packages/dashboard/src/components/globeImpl.test.tsx packages/dashboard/src/index.css
git commit -m "feat(atlas): 3-tier sprite billboards replace city/landmark labels"
```

### Task 7: Sprite failure fallback (never a broken-image glyph)

**Files:**
- Modify: `packages/dashboard/src/components/globeImpl.tsx`
- Modify: `packages/dashboard/src/index.css`
- Test: `packages/dashboard/src/components/globeImpl.test.tsx`

- [ ] **Step 1: Write the failing test** (append to the describe block):

```tsx
it("a failed sprite collapses to a tier-colored dot, not a broken image", () => {
  render(<GlobeImpl view={view} selectedId={null} onSelect={noop} width={800} height={600} />);
  const btn = screen.getByTestId("bb-c_arch");
  fireEvent.error(btn.querySelector("img") as HTMLImageElement);
  expect(btn.className).toContain("atlas-bb-broken");
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement.** Module-level in `globeImpl.tsx`:

```tsx
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
```

Wire it on the billboard image: `<img className="atlas-bb-img" ... onError={spriteFailed} />`.
CSS append:

```css
.atlas-bb-broken .atlas-bb-img { display: none; }
.atlas-bb-broken::before {
  content: ""; display: block; width: 10px; height: 10px; margin: 0 auto;
  border-radius: 50%; background: var(--bb-color, #e8e6e0);
}
```

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add packages/dashboard/src/components/globeImpl.tsx packages/dashboard/src/components/globeImpl.test.tsx packages/dashboard/src/index.css
git commit -m "feat(atlas): sprite onerror falls back to a tier-colored dot"
```

---

## Phase C — Ambiance

### Task 8: Ocean texture (with preload fallback) + land alpha + atmosphere

**Files:**
- Modify: `packages/dashboard/src/components/globeImpl.tsx`
- Test: `packages/dashboard/src/components/globeImpl.test.tsx`

- [ ] **Step 1: Write the failing tests** (append):

```tsx
it("the globe wears the night-atlas ocean and raised land alpha", () => {
  render(<GlobeImpl view={view} selectedId={null} onSelect={noop} width={800} height={600} />);
  expect(captured.props?.globeImageUrl).toBe("./atlas/ocean.jpg");
  const cap = captured.props?.polygonCapColor as (f: object) => string;
  // architecture/Asia is #e5687a; focused land alpha is now 0.55
  expect(cap({ properties: { continent: "Asia" } })).toBe("rgba(229, 104, 122, 0.55)");
});

it("falls back to earth-dark.jpg when the ocean texture is missing", async () => {
  class FailingImage {
    onerror: (() => void) | null = null;
    set src(_v: string) {
      queueMicrotask(() => this.onerror?.());
    }
  }
  vi.stubGlobal("Image", FailingImage);
  render(<GlobeImpl view={view} selectedId={null} onSelect={noop} width={800} height={600} />);
  await waitFor(() => expect(captured.props?.globeImageUrl).toBe("./earth-dark.jpg"));
});
```

Add `waitFor` to the testing-library import at the top of the file.

- [ ] **Step 2: Run — expect FAIL** (`globeImageUrl` is `./earth-dark.jpg`,
alpha is 0.42).

- [ ] **Step 3: Implement** in `globeImpl.tsx`:

```tsx
const OCEAN_URL = "./atlas/ocean.jpg";
const GLOBE_FALLBACK_URL = "./earth-dark.jpg"; // kept in public/ as the failure tier
```

Inside the component:

```tsx
// Failure tier: probe the ocean texture once; a 404 must not leave a bare sphere.
const [globeUrl, setGlobeUrl] = useState(OCEAN_URL);
useEffect(() => {
  const probe = new Image();
  probe.onerror = () => setGlobeUrl(GLOBE_FALLBACK_URL);
  probe.src = OCEAN_URL;
}, []);
```

`<Globe ... globeImageUrl={globeUrl}` (replacing the literal), focused polygon
alpha `0.42` → `0.55` in `polygonCap`, and `atmosphereColor="#5aa9f0"` →
`"#4a7fd6"` (start value per spec; tune by eye in Task 10).

- [ ] **Step 4: Run — expect PASS** (jsdom's stubless `Image` fires no events,
so the first test keeps the ocean URL). Run the full suite too.

- [ ] **Step 5: Commit**

```bash
git add packages/dashboard/src/components/globeImpl.tsx packages/dashboard/src/components/globeImpl.test.tsx
git commit -m "feat(atlas): night-atlas ocean texture with earth-dark fallback"
```

### Task 9: Compass rose + loading state

**Files:**
- Modify: `packages/dashboard/src/components/globeImpl.tsx`
- Modify: `packages/dashboard/src/index.css`
- Test: `packages/dashboard/src/components/globeImpl.test.tsx`

- [ ] **Step 1: Write the failing tests** (append):

```tsx
it("compass rose runs at full strength while the world fetch is in flight", () => {
  render(<GlobeImpl view={view} selectedId={null} onSelect={noop} width={800} height={600} />);
  expect(screen.getByTestId("atlas-compass").className).toContain("atlas-compass-loading");
});

it("compass settles to ornament opacity once the fetch finishes (even on failure)", async () => {
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 404 })));
  render(<GlobeImpl view={view} selectedId={null} onSelect={noop} width={800} height={600} />);
  await waitFor(() =>
    expect(screen.getByTestId("atlas-compass").className).not.toContain("atlas-compass-loading"),
  );
});
```

- [ ] **Step 2: Run — expect FAIL** (no `atlas-compass` testid).

- [ ] **Step 3: Implement.** Track fetch settlement next to the existing
`world` state in `globeImpl.tsx`:

```tsx
const [worldPending, setWorldPending] = useState(true);
```

In the existing world-fetch effect, append `.finally(...)` after the `.catch`:

```tsx
.catch(() => {}) // polygons are decoration; the globe works without them
.finally(() => { if (alive) setWorldPending(false); });
```

In the overlay div (after the billboard buttons):

```tsx
<img
  className={`atlas-compass${worldPending ? " atlas-compass-loading" : ""}`}
  data-testid="atlas-compass"
  src="./atlas/compass.png"
  alt=""
  draggable={false}
/>
```

CSS append:

```css
.atlas-compass {
  position: absolute; left: 14px; bottom: 14px; width: 72px;
  opacity: 0.5; pointer-events: none; transition: opacity 400ms ease;
}
.atlas-compass-loading { opacity: 1; }
```

- [ ] **Step 4: Run — expect PASS**, then full suite + typecheck.

- [ ] **Step 5: Commit**

```bash
git add packages/dashboard/src/components/globeImpl.tsx packages/dashboard/src/components/globeImpl.test.tsx packages/dashboard/src/index.css
git commit -m "feat(atlas): compass rose ornament doubles as the loading state"
```

### Task 10: Full verification + four-altitude screenshot pass

- [ ] **Step 1: Full suite + typecheck**

```bash
npm run test -w packages/dashboard
npm run typecheck -w packages/dashboard
```

Expected: all green (including the pre-existing 44 test files).

- [ ] **Step 2: Run the dashboard** (`npm run dev -w packages/dashboard`) and
screenshot the four altitudes via Chrome DevTools MCP: Orbit (nothing
selected), a Continent, a City, a Landmark. Verify by eye, against the spec:
city emblems on disc bases with CAPS letterspaced labels; bare landmark pins
with quiet off-white staggered labels; the focused city receding at Landmark
altitude; ocean texture land-free under accurate polygon coastlines; compass
bottom-left. Tune `TIER_SCALE` multipliers and `atmosphereColor` by eye if
needed (constants only — commit any tweak).

- [ ] **Step 3: Show the four screenshots to the user**, then commit any
tuning:

```bash
git add -A packages/dashboard/src
git commit -m "polish(atlas): tier-scale and atmosphere tuning after screenshot pass"
```
