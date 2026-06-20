// xterm.js view bound to a backend PTY. Spawns the shell on mount, streams
// output in via the event channel, forwards keystrokes out, and keeps the PTY
// sized to the pane. The xterm theme is derived from the design tokens so the
// terminal matches the rest of the canvas.

import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { ipc, isTauri, onTerminalOutput } from "../lib/ipc";
import "./TerminalView.css";

const THEME = {
  background: "#0a0a0a", // --color-canvas
  foreground: "#cccccc", // --color-body
  cursor: "#faff69", // --color-primary
  cursorAccent: "#0a0a0a",
  selectionBackground: "#faff69",
  selectionForeground: "#0a0a0a",
  black: "#0a0a0a",
  brightBlack: "#5a5a5a",
  white: "#cccccc",
  brightWhite: "#ffffff",
  green: "#22c55e",
  red: "#ef4444",
  blue: "#3b82f6",
  yellow: "#faff69",
};

/**
 * Terminal pane. Either opens a fresh local PTY (`shell` given) or attaches to
 * an already-opened backend session such as an SSH shell (`attachId` given).
 * Both modes share the same output event channel and input/resize commands.
 */
export function TerminalView({
  shell,
  attachId,
}: {
  shell?: string;
  attachId?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hostRef.current) return;

    const term = new Terminal({
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fontSize: 14,
      lineHeight: 1.2,
      cursorBlink: true,
      theme: THEME,
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(hostRef.current);
    fit.fit();

    if (!isTauri) {
      term.writeln("\x1b[38;2;250;255;105mVoltaic\x1b[0m — terminal preview");
      term.writeln("Run inside the Tauri shell for a live session.");
      return () => term.dispose();
    }

    // SSH sessions are opened by the connect form; local shells open here.
    const ownsSession = attachId === undefined;
    let sessionId: string | null = attachId ?? null;
    let unlisten: (() => void) | null = null;
    let disposed = false;
    const decoder = new TextDecoder();

    const bind = async (id: string) => {
      unlisten = await onTerminalOutput(id, (bytes) => {
        term.write(decoder.decode(bytes, { stream: true }));
      });
      term.onData((data) => ipc.terminalInput(id, data));
      ipc.terminalResize(id, term.rows, term.cols);
    };

    (async () => {
      if (ownsSession) {
        sessionId = await ipc.openTerminal(shell ?? "default", term.rows, term.cols);
        if (disposed) {
          await ipc.closeTerminal(sessionId);
          return;
        }
      }
      if (sessionId) await bind(sessionId);
    })();

    const onResize = () => {
      fit.fit();
      if (sessionId) ipc.terminalResize(sessionId, term.rows, term.cols);
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(hostRef.current);

    return () => {
      disposed = true;
      observer.disconnect();
      unlisten?.();
      // Only tear down sessions we own; attached SSH shells are closed by their
      // owning component so the connection isn't dropped on a transient remount.
      if (sessionId && ownsSession) ipc.closeTerminal(sessionId);
      term.dispose();
    };
  }, [shell, attachId]);

  return <div className="terminal" ref={hostRef} />;
}
