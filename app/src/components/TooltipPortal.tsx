import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface TipState {
  text: string;
  left: number;
  top: number;
  transform: string;
}

function computePos(el: HTMLElement): TipState {
  const r = el.getBoundingClientRect();
  const pos = el.dataset.tooltipPos ?? "top";
  const text = el.dataset.tooltip ?? "";
  switch (pos) {
    case "bottom":
      return { text, left: r.left + r.width / 2, top: r.bottom + 8, transform: "translate(-50%, 0)" };
    case "right":
      return { text, left: r.right + 8, top: r.top + r.height / 2, transform: "translate(0, -50%)" };
    case "left":
      return { text, left: r.left - 8, top: r.top + r.height / 2, transform: "translate(-100%, -50%)" };
    case "bottom-end":
      return { text, left: r.right, top: r.bottom + 8, transform: "translate(-100%, 0)" };
    default: // top
      return { text, left: r.left + r.width / 2, top: r.top - 8, transform: "translate(-50%, -100%)" };
  }
}

const MARGIN = 8;

export function TooltipPortal() {
  const [state, setState] = useState<TipState | null>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRef = useRef<HTMLElement | null>(null);
  const divRef = useRef<HTMLDivElement>(null);

  // After each render, clamp the tooltip inside the viewport before the browser paints.
  useLayoutEffect(() => {
    const div = divRef.current;
    if (!div || !visible || !state) return;
    const r = div.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (r.left < MARGIN) div.style.left = `${state.left + (MARGIN - r.left)}px`;
    else if (r.right > vw - MARGIN) div.style.left = `${state.left - (r.right - (vw - MARGIN))}px`;
    if (r.top < MARGIN) div.style.top = `${state.top + (MARGIN - r.top)}px`;
    else if (r.bottom > vh - MARGIN) div.style.top = `${state.top - (r.bottom - (vh - MARGIN))}px`;
  }, [state, visible]);

  useEffect(() => {
    const show = (el: HTMLElement) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (currentRef.current === el && el.dataset.tooltip) {
          setState(computePos(el));
          setVisible(true);
        }
      }, 350);
    };

    const hide = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setVisible(false);
    };

    const onOver = (e: MouseEvent) => {
      const el = (e.target as Element).closest?.("[data-tooltip]") as HTMLElement | null;
      if (el === currentRef.current) return;
      hide();
      currentRef.current = el;
      if (el?.dataset.tooltip) show(el);
    };

    const onDown = () => {
      currentRef.current = null;
      hide();
    };

    document.addEventListener("mouseover", onOver);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mousedown", onDown);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return createPortal(
    <div
      ref={divRef}
      role="tooltip"
      className={`tooltip-portal${visible && state ? " is-visible" : ""}`}
      style={
        state
          ? { left: state.left, top: state.top, transform: state.transform }
          : undefined
      }
    >
      {state?.text ?? ""}
    </div>,
    document.body,
  );
}
