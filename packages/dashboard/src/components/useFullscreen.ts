import { useEffect, useState, type RefObject } from "react";

// Fullscreen for the globe stage: native Fullscreen API where available,
// otherwise a CSS pseudo-fullscreen (fixed inset-0 via the returned `active`
// class). Esc exits both (the browser handles native; we handle the fallback).
export function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const [nativeActive, setNativeActive] = useState(false);
  const [cssActive, setCssActive] = useState(false);

  useEffect(() => {
    const onChange = () => setNativeActive(document.fullscreenElement === ref.current && ref.current != null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [ref]);

  useEffect(() => {
    if (!cssActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCssActive(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [cssActive]);

  const active = nativeActive || cssActive;
  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (cssActive) {
      setCssActive(false);
    } else if (typeof el.requestFullscreen === "function") {
      if (document.fullscreenElement) void document.exitFullscreen();
      // Permission-restricted contexts (iframes, untrusted gestures) reject —
      // degrade to the CSS pseudo-fullscreen instead of doing nothing.
      else el.requestFullscreen().catch(() => setCssActive(true));
    } else {
      setCssActive(true);
    }
  };
  return { active, toggle };
}
