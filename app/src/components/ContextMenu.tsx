// Reusable right-click / action context menu. Used by the session tree and the
// SFTP browsers. Closes on outside click or Escape; clamps to the viewport.

import { useEffect, useRef } from "react";
import "./ContextMenu.css";

export type CtxItem =
  | { kind: "sep" }
  | {
      kind: "action";
      label: string;
      danger?: boolean;
      disabled?: boolean;
      icon?: React.ReactNode;
      onClick: () => void;
    }
  | {
      kind: "swatches";
      label: string;
      /** `null` value represents "no color / default". */
      colors: { value: string | null; label: string }[];
      current: string | null;
      onPick: (value: string | null) => void;
    };

export interface CtxState {
  x: number;
  y: number;
  items: CtxItem[];
}

export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: CtxItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const t = setTimeout(() => document.addEventListener("mousedown", onPointer), 40);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const rows = items.filter((i) => i.kind !== "sep").length;
  const style: React.CSSProperties = {
    top: Math.min(y, window.innerHeight - (rows * 34 + 24)),
    left: Math.min(x, window.innerWidth - 192),
  };

  return (
    <div ref={ref} className="ctxmenu" style={style} role="menu">
      {items.map((item, i) =>
        item.kind === "sep" ? (
          <div key={i} className="ctxmenu__sep" />
        ) : item.kind === "swatches" ? (
          <div key={i} className="ctxmenu__swatches">
            <span className="ctxmenu__swatches-label">{item.label}</span>
            <div className="ctxmenu__swatches-row">
              {item.colors.map((c) => {
                const active = (c.value ?? null) === (item.current ?? null);
                return (
                  <button
                    key={c.value ?? "none"}
                    className={`ctxmenu__swatch${active ? " is-active" : ""}${c.value ? "" : " ctxmenu__swatch--none"}`}
                    style={c.value ? { background: c.value, color: c.value } : undefined}
                    data-tooltip={c.label}
                    aria-label={c.label}
                    onClick={() => {
                      item.onPick(c.value);
                      onClose();
                    }}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <button
            key={i}
            role="menuitem"
            disabled={item.disabled}
            className={`ctxmenu__item${item.danger ? " ctxmenu__item--danger" : ""}`}
            onClick={() => {
              if (item.disabled) return;
              item.onClick();
              onClose();
            }}
          >
            <span className="ctxmenu__label">{item.label}</span>
            {item.icon && <span className="ctxmenu__icon">{item.icon}</span>}
          </button>
        ),
      )}
    </div>
  );
}
