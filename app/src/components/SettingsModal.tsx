// Settings dialog — a categorized preferences panel in the spirit of
// MobaXterm's configuration window: a left rail of sections and a right pane
// of controls. Changes apply live (accent, theme, motion) and persist to the
// TOML config via the IPC layer.

import { useEffect, useRef, useState } from "react";
import { ipc, isTauri } from "../lib/ipc";
import { exportSessions, importSessions } from "../lib/sessionTransfer";
import type { Config } from "../lib/types";
import { useAppStore } from "../store/appStore";
import { ACCENT_PRESETS, applyAccent, applyAnimations } from "../lib/appearance";
import "./SettingsModal.css";

type Section = "appearance" | "sessions" | "terminal" | "security" | "updates" | "about";

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: "appearance", label: "Appearance", icon: "◑" },
  { id: "sessions", label: "Sessions", icon: "≡" },
  { id: "terminal", label: "Terminal", icon: "▣" },
  { id: "security", label: "Security", icon: "⚿" },
  { id: "updates", label: "Updates", icon: "↻" },
  { id: "about", label: "About", icon: "ⓘ" },
];

const SHELLS = ["powershell", "cmd", "wsl", "bash", "zsh", "fish"];

export function SettingsModal() {
  const open = useAppStore((s) => s.settingsOpen);
  const close = useAppStore((s) => s.closeSettings);
  const setTheme = useAppStore((s) => s.setTheme);
  const bumpSessionVersion = useAppStore((s) => s.bumpSessionVersion);

  const [section, setSection] = useState<Section>("appearance");
  const [config, setConfig] = useState<Config | null>(null);
  const [sessionMsg, setSessionMsg] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load the current config whenever the dialog is opened.
  useEffect(() => {
    if (!open || !isTauri) return;
    ipc.getConfig().then(setConfig).catch(() => setConfig(null));
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;

  // Merge a partial change into config state and persist (debounced) so that
  // dragging a slider doesn't hammer the filesystem.
  const patch = (next: Config) => {
    setConfig(next);
    if (!isTauri) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      ipc.saveConfig(next).catch(() => {});
    }, 250);
  };

  const setAppearance = (p: Partial<Config["appearance"]>) => {
    if (!config) return;
    patch({ ...config, appearance: { ...config.appearance, ...p } });
  };
  const setTerminal = (p: Partial<Config["terminal"]>) => {
    if (!config) return;
    patch({ ...config, terminal: { ...config.terminal, ...p } });
  };
  const setSecurity = (p: Partial<Config["security"]>) => {
    if (!config) return;
    patch({ ...config, security: { ...config.security, ...p } });
  };
  const setUpdates = (p: Partial<Config["updates"]>) => {
    if (!config) return;
    patch({ ...config, updates: { ...config.updates, ...p } });
  };

  const chooseAccent = (value: string) => {
    applyAccent(value); // live
    setAppearance({ accent: value });
  };

  const doImport = async () => {
    if (!isTauri) return;
    setSessionMsg(null);
    try {
      const n = await importSessions();
      if (n === null) return; // cancelled
      bumpSessionVersion();
      setSessionMsg(
        n ? `Imported ${n} session${n === 1 ? "" : "s"}.` : "No sessions found in that file.",
      );
    } catch (e) {
      setSessionMsg(`Import failed: ${e}`);
    }
  };

  const doExport = async () => {
    if (!isTauri) return;
    setSessionMsg(null);
    try {
      const n = await exportSessions();
      if (n === null) return; // cancelled
      setSessionMsg(`Exported ${n} session${n === 1 ? "" : "s"}.`);
    } catch (e) {
      setSessionMsg(`Export failed: ${e}`);
    }
  };

  return (
    <div
      className="set-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="set-card" role="dialog" aria-modal="true">
        <div className="set-header">
          <span className="set-title">Settings</span>
          <button className="set-close" onClick={close} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="set-body">
          {/* Category rail */}
          <nav className="set-nav">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                className={`set-nav-item${section === s.id ? " is-active" : ""}`}
                onClick={() => setSection(s.id)}
              >
                <span className="set-nav-icon">{s.icon}</span>
                {s.label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="set-content">
            {!config ? (
              <p className="set-loading">Loading…</p>
            ) : section === "appearance" ? (
              <>
                <Group label="Theme">
                  <div className="set-segment">
                    {(["dark", "light"] as const).map((t) => (
                      <button
                        key={t}
                        className={`set-seg-btn${config.appearance.theme === t ? " is-active" : ""}`}
                        onClick={() => {
                          setTheme(t);
                          setAppearance({ theme: t });
                        }}
                      >
                        {t === "dark" ? "Dark" : "Light"}
                      </button>
                    ))}
                  </div>
                </Group>

                <Group label="Accent color" hint="Changes the highlight color across the app.">
                  <div className="set-swatches">
                    {ACCENT_PRESETS.map((a) => (
                      <button
                        key={a.id}
                        className={`set-swatch${
                          config.appearance.accent.toLowerCase() === a.value.toLowerCase()
                            ? " is-active"
                            : ""
                        }`}
                        style={{ background: a.value, color: a.value }}
                        title={a.label}
                        aria-label={a.label}
                        onClick={() => chooseAccent(a.value)}
                      />
                    ))}
                  </div>
                </Group>

                <Toggle
                  label="Animations"
                  hint="UI motion and transitions."
                  checked={config.appearance.animations}
                  onChange={(v) => {
                    applyAnimations(v);
                    setAppearance({ animations: v });
                  }}
                />
                <Toggle
                  label="Blur effects"
                  hint="Backdrop blur where the OS supports it."
                  checked={config.appearance.blur_effects}
                  onChange={(v) => setAppearance({ blur_effects: v })}
                />

                <Group label={`Window opacity — ${Math.round(config.appearance.window_opacity * 100)}%`}>
                  <input
                    type="range"
                    className="set-range"
                    min={0.6}
                    max={1}
                    step={0.01}
                    value={config.appearance.window_opacity}
                    onChange={(e) => setAppearance({ window_opacity: Number(e.target.value) })}
                  />
                </Group>
              </>
            ) : section === "sessions" ? (
              <>
                <Group
                  label="Import sessions"
                  hint="Load sessions from a session file. Passwords are not included."
                >
                  <button className="set-btn" onClick={doImport}>
                    Import sessions…
                  </button>
                </Group>
                <Group
                  label="Export sessions"
                  hint="Save all your sessions to a session file (without passwords)."
                >
                  <button className="set-btn" onClick={doExport}>
                    Export sessions…
                  </button>
                </Group>
                {sessionMsg && <p className="set-session-msg">{sessionMsg}</p>}
              </>
            ) : section === "terminal" ? (
              <>
                <Group label="Font family">
                  <input
                    className="set-input"
                    value={config.terminal.font_family}
                    onChange={(e) => setTerminal({ font_family: e.target.value })}
                  />
                </Group>
                <Group label="Font size">
                  <input
                    type="number"
                    className="set-input set-input--sm"
                    min={8}
                    max={32}
                    value={config.terminal.font_size}
                    onChange={(e) => setTerminal({ font_size: Number(e.target.value) })}
                  />
                </Group>
                <Group label="Default shell">
                  <select
                    className="set-input"
                    value={config.terminal.default_shell}
                    onChange={(e) => setTerminal({ default_shell: e.target.value })}
                  >
                    {SHELLS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Group>
                <Group label="Scrollback (lines)">
                  <input
                    type="number"
                    className="set-input set-input--sm"
                    min={0}
                    max={1000000}
                    step={1000}
                    value={config.terminal.scrollback}
                    onChange={(e) => setTerminal({ scrollback: Number(e.target.value) })}
                  />
                </Group>
              </>
            ) : section === "security" ? (
              <>
                <Toggle
                  label="Use OS keychain"
                  hint="Store secrets in the system keychain instead of the local vault."
                  checked={config.security.use_os_keychain}
                  onChange={(v) => setSecurity({ use_os_keychain: v })}
                />
                <Group label="Auto-lock (minutes)" hint="0 disables auto-lock.">
                  <input
                    type="number"
                    className="set-input set-input--sm"
                    min={0}
                    max={1440}
                    value={config.security.auto_lock_minutes}
                    onChange={(e) => setSecurity({ auto_lock_minutes: Number(e.target.value) })}
                  />
                </Group>
              </>
            ) : section === "updates" ? (
              <>
                <Toggle
                  label="Automatic update checks"
                  checked={config.updates.auto_check}
                  onChange={(v) => setUpdates({ auto_check: v })}
                />
                <Group label="Release channel">
                  <div className="set-segment">
                    {(["stable", "beta"] as const).map((c) => (
                      <button
                        key={c}
                        className={`set-seg-btn${config.updates.channel === c ? " is-active" : ""}`}
                        onClick={() => setUpdates({ channel: c })}
                      >
                        {c === "stable" ? "Stable" : "Beta"}
                      </button>
                    ))}
                  </div>
                </Group>
              </>
            ) : (
              <div className="set-about">
                <svg
                  className="set-about-mark"
                  viewBox="0 0 24 24"
                  width="44"
                  height="44"
                  aria-hidden="true"
                >
                  <path d="M13 2L4 14h6l-1 8 9-12h-6z" fill="currentColor" />
                </svg>
                <div className="set-about-name">Voltaic</div>
                <p className="set-about-text">
                  A MobaXterm-class connection manager. Preferences are stored as TOML and applied
                  instantly.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Group({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="set-group">
      <div className="set-group-head">
        <span className="set-group-label">{label}</span>
        {hint && <span className="set-group-hint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button className="set-toggle" onClick={() => onChange(!checked)}>
      <span className="set-toggle-text">
        <span className="set-group-label">{label}</span>
        {hint && <span className="set-group-hint">{hint}</span>}
      </span>
      <span className={`set-switch${checked ? " is-on" : ""}`}>
        <span className="set-switch-knob" />
      </span>
    </button>
  );
}
