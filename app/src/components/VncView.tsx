// A VNC tab: a connection form, then a <canvas> rendering the remote desktop.
// Framebuffer rectangles arrive on the vnc-event channel (base64 RGBA) and are
// blitted with putImageData; CopyRect events shift a region of the canvas.
// Pointer (with an RFB button mask) and keyboard (X11 keysyms) are captured on
// the canvas and sent back. Reuses the RDP view's styling.

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ipc, onVncEvent } from "../lib/ipc";
import type { VncConfig, VncInput } from "../lib/types";
import { keysymFor } from "../lib/vncKeymap";
import "./RdpView.css";

export function VncView({ initialConfig }: { initialConfig?: VncConfig }) {
  const { t } = useTranslation();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const idRef = useRef<string | null>(null);
  const didAuto = useRef(false);
  const buttonMask = useRef(0);

  useEffect(() => {
    idRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    return () => {
      if (idRef.current) ipc.closeVnc(idRef.current);
    };
  }, []);

  const connect = async (config: VncConfig) => {
    setError(null);
    setConnecting(true);
    try {
      const id = await ipc.openVnc(config);
      setSessionId(id);
    } catch (e) {
      setError(String(e));
      setConnecting(false);
    }
  };

  useEffect(() => {
    if (initialConfig && !didAuto.current) {
      didAuto.current = true;
      connect(initialConfig);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sessionId) return;
    let unlisten: (() => void) | undefined;
    let disposed = false;

    onVncEvent(sessionId, (ev) => {
      const canvas = canvasRef.current;
      if (ev.kind === "resized") {
        setSize({ w: ev.width, h: ev.height });
        setConnecting(false);
        if (canvas) {
          canvas.width = ev.width;
          canvas.height = ev.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, ev.width, ev.height);
          }
        }
      } else if (ev.kind === "frame" && ev.data && canvas) {
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const bin = atob(ev.data);
        const arr = new Uint8ClampedArray(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        ctx.putImageData(new ImageData(arr, ev.width, ev.height), ev.x, ev.y);
      } else if (ev.kind === "copy" && canvas) {
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        // Copy a region of the canvas to a new position (RFB CopyRect).
        ctx.drawImage(
          canvas,
          ev.src_x,
          ev.src_y,
          ev.width,
          ev.height,
          ev.x,
          ev.y,
          ev.width,
          ev.height,
        );
      } else if (ev.kind === "disconnected") {
        setError(ev.reason ?? "Session ended");
      }
    }).then((fn) => {
      if (disposed) fn();
      else unlisten = fn;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [sessionId]);

  // ---- input ----

  const send = (input: VncInput) => {
    const id = idRef.current;
    if (id) ipc.vncInput(id, input).catch(() => {});
  };

  const toDesktop = (e: React.MouseEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas || !size) return null;
    const r = canvas.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    const x = Math.round(((e.clientX - r.left) / r.width) * size.w);
    const y = Math.round(((e.clientY - r.top) / r.height) * size.h);
    return {
      x: Math.max(0, Math.min(size.w - 1, x)),
      y: Math.max(0, Math.min(size.h - 1, y)),
    };
  };

  const sendPointer = (e: React.MouseEvent) => {
    const p = toDesktop(e);
    if (p) send({ kind: "pointer", x: p.x, y: p.y, buttons: buttonMask.current });
  };

  const onMouseDown = (e: React.MouseEvent) => {
    canvasRef.current?.focus();
    buttonMask.current |= 1 << e.button;
    sendPointer(e);
  };

  const onMouseUp = (e: React.MouseEvent) => {
    buttonMask.current &= ~(1 << e.button);
    sendPointer(e);
  };

  const onWheel = (e: React.WheelEvent) => {
    const p = toDesktop(e as unknown as React.MouseEvent);
    if (!p) return;
    const bit = e.deltaY < 0 ? 1 << 3 : 1 << 4; // wheel up : down
    send({ kind: "pointer", x: p.x, y: p.y, buttons: buttonMask.current | bit });
    send({ kind: "pointer", x: p.x, y: p.y, buttons: buttonMask.current });
  };

  const onKey = (e: React.KeyboardEvent, down: boolean) => {
    const keysym = keysymFor(e);
    if (keysym === null) return;
    e.preventDefault();
    send({ kind: "key", keysym, down });
  };

  if (!sessionId || connecting) {
    return (
      <VncConnectForm busy={connecting} error={error} initialConfig={initialConfig} onConnect={connect} />
    );
  }

  return (
    <div className="rdp">
      {error && (
        <div className="rdp__banner">
          {error}
          <button
            className="rdp__reconnect"
            onClick={() => {
              setError(null);
              setSessionId(null);
              setConnecting(false);
            }}
          >
            {t("common.reconnect")}
          </button>
        </div>
      )}
      <div className="rdp__stage">
        <canvas
          ref={canvasRef}
          className="rdp__canvas"
          tabIndex={0}
          onMouseMove={sendPointer}
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onContextMenu={(e) => e.preventDefault()}
          onWheel={onWheel}
          onKeyDown={(e) => onKey(e, true)}
          onKeyUp={(e) => onKey(e, false)}
        />
      </div>
    </div>
  );
}

function VncConnectForm({
  busy,
  error,
  initialConfig,
  onConnect,
}: {
  busy: boolean;
  error: string | null;
  initialConfig?: VncConfig;
  onConnect: (config: VncConfig) => void;
}) {
  const { t } = useTranslation();
  const [host, setHost] = useState(initialConfig?.host ?? "");
  const [port, setPort] = useState(initialConfig?.port ?? 5900);
  const [password, setPassword] = useState(initialConfig?.password ?? "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onConnect({ host, port, password });
  };

  if (busy) {
    return <div className="rdp__connecting">{t("form.connecting_to", { host })}</div>;
  }

  return (
    <div className="rdp-connect">
      <form className="rdp-connect__card" onSubmit={submit}>
        <h2 className="rdp-connect__title">VNC</h2>

        <div className="rdp-connect__row">
          <label className="rdp-connect__field rdp-connect__field--grow">
            <span>{t("form.host")}</span>
            <input
              className="rdp-connect__input"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder={t("form.ph_ip")}
              required
              autoFocus
            />
          </label>
          <label className="rdp-connect__field rdp-connect__field--port">
            <span>{t("form.port")}</span>
            <input
              className="rdp-connect__input"
              type="number"
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
              min={1}
              max={65535}
            />
          </label>
        </div>

        <label className="rdp-connect__field">
          <span>{t("form.password")}</span>
          <input
            className="rdp-connect__input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("form.ph_vnc_pass")}
          />
        </label>

        {error && <p className="rdp-connect__error">{error}</p>}

        <button className="rdp-connect__submit" type="submit">
          {t("common.connect")}
        </button>
      </form>
    </div>
  );
}
