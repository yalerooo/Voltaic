// Hook for OS file drag-and-drop onto a specific element. Tauri intercepts
// native file drops at the window level (HTML5 drag events don't fire for OS
// files), so we subscribe to the webview drag-drop event and route a drop to
// this element only when the pointer is within its bounds. Returns whether a
// drag is currently hovering the element, for highlight styling.

import { useEffect, useRef, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { isTauri } from "./ipc";

export function useFileDrop<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  enabled: boolean,
  onDrop: (paths: string[]) => void,
): boolean {
  const [isOver, setIsOver] = useState(false);
  const onDropRef = useRef(onDrop);
  useEffect(() => {
    onDropRef.current = onDrop;
  }, [onDrop]);

  useEffect(() => {
    if (!isTauri || !enabled) return;
    let unlisten: (() => void) | undefined;
    let disposed = false;

    const within = (pos?: { x: number; y: number }) => {
      const el = ref.current;
      if (!el || !pos) return false;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return false; // hidden
      const dpr = window.devicePixelRatio || 1;
      const x = pos.x / dpr;
      const y = pos.y / dpr;
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };

    getCurrentWebview()
      .onDragDropEvent((event) => {
        const p = event.payload;
        if (p.type === "enter" || p.type === "over") {
          setIsOver(within(p.position));
        } else if (p.type === "leave") {
          setIsOver(false);
        } else if (p.type === "drop") {
          const inside = within(p.position);
          setIsOver(false);
          if (inside && p.paths.length) onDropRef.current(p.paths);
        }
      })
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      });

    return () => {
      disposed = true;
      unlisten?.();
      setIsOver(false);
    };
  }, [enabled, ref]);

  return isOver;
}
