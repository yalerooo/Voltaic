// Global command palette (Ctrl/Cmd+Shift+P, Ctrl/Cmd+K) — the Raycast/Cursor
// surface for universal search and quick actions. Phase 1 ships the action
// registry + fuzzy filter; universal search over hosts/history hooks in later.

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/appStore";
import "./CommandPalette.css";

interface Action {
  id: string;
  title: string;
  hint: string;
  run: () => void;
}

export function CommandPalette() {
  const { t } = useTranslation();
  const { paletteOpen, setPaletteOpen, openTab, theme, setTheme } =
    useAppStore();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const actions = useMemo<Action[]>(
    () => [
      {
        id: "new-terminal",
        title: t("commandPalette.new_terminal"),
        hint: t("commandPalette.new_terminal_hint"),
        run: () =>
          openTab({ title: "Terminal", kind: "terminal", shell: "default" }),
      },
      {
        id: "new-ssh",
        title: t("commandPalette.new_ssh"),
        hint: t("commandPalette.new_ssh_hint"),
        run: () => openTab({ title: "SSH", kind: "session", protocol: "ssh" }),
      },
      {
        id: "toggle-theme",
        title: theme === "dark" ? t("commandPalette.toggle_theme_light") : t("commandPalette.toggle_theme_dark"),
        hint: t("commandPalette.toggle_theme_hint"),
        run: () => setTheme(theme === "dark" ? "light" : "dark"),
      },
    ],
    [t, openTab, theme, setTheme],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter((a) =>
      (a.title + " " + a.hint).toLowerCase().includes(q),
    );
  }, [actions, query]);

  useEffect(() => {
    if (paletteOpen) {
      setQuery("");
      setCursor(0);
      // Focus after the open transition begins.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [paletteOpen]);

  if (!paletteOpen) return null;

  const choose = (i: number) => {
    const action = filtered[i];
    if (action) {
      action.run();
      setPaletteOpen(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setPaletteOpen(false);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, filtered.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    }
    if (e.key === "Enter") {
      e.preventDefault();
      choose(cursor);
    }
  };

  return (
    <div className="palette__scrim" onMouseDown={() => setPaletteOpen(false)}>
      <div
        className="palette"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <input
          ref={inputRef}
          className="palette__input"
          placeholder={t("commandPalette.placeholder")}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCursor(0);
          }}
        />
        <ul className="palette__list">
          {filtered.length === 0 && (
            <li className="palette__empty">{t("commandPalette.no_results")}</li>
          )}
          {filtered.map((a, i) => (
            <li
              key={a.id}
              className={"palette__item" + (i === cursor ? " is-active" : "")}
              onMouseEnter={() => setCursor(i)}
              onClick={() => choose(i)}
            >
              <span className="palette__title">{a.title}</span>
              <span className="palette__hint">{a.hint}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
