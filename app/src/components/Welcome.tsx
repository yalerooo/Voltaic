// Welcome / home tab. A canvas-anchored hero using the design system's display
// type and yellow stat-callouts — the brand's "voltage" moment.

import { useAppStore } from "../store/appStore";
import "./Welcome.css";

const STATS = [
  { value: "13", label: "Capability crates" },
  { value: "6", label: "Local shells" },
  { value: "9", label: "Protocols planned" },
];

export function Welcome() {
  const { openTab, togglePalette } = useAppStore();
  return (
    <div className="welcome">
      <div className="welcome__hero">
        <span className="welcome__badge">
          <svg
            className="welcome__badge-bolt"
            viewBox="0 0 24 24"
            width="12"
            height="12"
            aria-hidden="true"
          >
            <path d="M13 2L4 14h6l-1 8 9-12h-6z" fill="currentColor" />
          </svg>
          Voltaic · alpha
        </span>
        <h1 className="welcome__title">
          The modern connection
          <br />
          manager, built in Rust.
        </h1>
        <p className="welcome__lede">
          Terminals, SSH, SFTP, RDP, VNC, Serial, Docker and Kubernetes — one
          fast, low-memory desktop app. Native on Windows, macOS and Linux.
        </p>
        <div className="welcome__actions">
          <button
            className="btn btn--primary"
            onClick={() =>
              openTab({ title: "Terminal", kind: "terminal", shell: "default" })
            }
          >
            Open a terminal
          </button>
          <button className="btn btn--secondary" onClick={togglePalette}>
            Command palette
          </button>
        </div>

        <div className="welcome__stats">
          {STATS.map((s) => (
            <div key={s.label} className="welcome__stat">
              <span className="welcome__stat-value">{s.value}</span>
              <span className="welcome__stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
