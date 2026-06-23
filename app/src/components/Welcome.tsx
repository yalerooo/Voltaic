// Welcome / home tab. A canvas-anchored hero using the design system's display
// type and yellow stat-callouts — the brand's "voltage" moment.

import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/appStore";
import "./Welcome.css";

export function Welcome() {
  const { t } = useTranslation();
  const { openTab, togglePalette } = useAppStore();

  const STATS = [
    { value: "13", label: t("welcome.stat_crates") },
    { value: "6", label: t("welcome.stat_shells") },
    { value: "9", label: t("welcome.stat_protocols") },
  ];

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
          {t("welcome.badge")}
        </span>
        <h1 className="welcome__title">
          {t("welcome.title").split("\n").map((line, i) => (
            <span key={i}>{line}{i === 0 && <br />}</span>
          ))}
        </h1>
        <p className="welcome__lede">{t("welcome.lede")}</p>
        <div className="welcome__actions">
          <button
            className="btn btn--primary"
            onClick={() =>
              openTab({ title: t("tabbar.new_terminal"), kind: "terminal", shell: "default" })
            }
          >
            {t("welcome.open_terminal")}
          </button>
          <button className="btn btn--secondary" onClick={togglePalette}>
            {t("welcome.command_palette")}
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
