import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ipc, isTauri } from "./lib/ipc";
import { useAppStore } from "./store/appStore";
import { applyAccent, applyAnimations } from "./lib/appearance";
import "./styles/global.css";
import i18n from "./i18n";

// Apply persisted appearance (theme, accent, motion, language) before first paint.
async function bootstrap() {
  if (isTauri) {
    try {
      const config = await ipc.getConfig();
      const theme =
        config.appearance.theme === "light" ? "light" : "dark";
      useAppStore.getState().setTheme(theme);
      applyAccent(config.appearance.accent);
      applyAnimations(config.appearance.animations);
      if (config.appearance.language) {
        await i18n.changeLanguage(config.appearance.language);
      }
    } catch {
      // Fall back to the default dark theme + voltage accent.
    }
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

bootstrap();
