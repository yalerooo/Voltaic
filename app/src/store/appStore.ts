import { create } from "zustand";
import type {
  DockerConfig,
  FtpConfig,
  KubernetesConfig,
  Protocol,
  RdpConfig,
  SerialConfig,
  SshConfig,
  VncConfig,
} from "../lib/types";

let tabSeq = 0;
const nextTabId = () => `tab-${++tabSeq}`;

export type TabKind = "welcome" | "terminal" | "session";

export interface Tab {
  id: string;
  title: string;
  kind: TabKind;
  protocol?: Protocol;
  shell?: string;
  sshConfig?: SshConfig;
  serialConfig?: SerialConfig;
  rdpConfig?: RdpConfig;
  vncConfig?: VncConfig;
  ftpConfig?: FtpConfig;
  dockerConfig?: DockerConfig;
  kubernetesConfig?: KubernetesConfig;
}

interface AppState {
  tabs: Tab[];
  activeTabId: string | null;
  paletteOpen: boolean;
  theme: "dark" | "light";
  newSessionModalOpen: boolean;
  settingsOpen: boolean;
  sessionListVersion: number;

  openTab: (tab: Omit<Tab, "id">) => string;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  setPaletteOpen: (open: boolean) => void;
  togglePalette: () => void;
  setTheme: (theme: "dark" | "light") => void;
  openNewSessionModal: () => void;
  closeNewSessionModal: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  bumpSessionVersion: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  tabs: [{ id: nextTabId(), title: "Welcome", kind: "welcome" }],
  activeTabId: "tab-1",
  paletteOpen: false,
  theme: "dark",
  newSessionModalOpen: false,
  settingsOpen: false,
  sessionListVersion: 0,

  openTab: (tab) => {
    const id = nextTabId();
    set((s) => ({ tabs: [...s.tabs, { ...tab, id }], activeTabId: id }));
    return id;
  },

  closeTab: (id) => {
    const { tabs, activeTabId } = get();
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const next = tabs.filter((t) => t.id !== id);
    let nextActive = activeTabId;
    if (activeTabId === id) {
      const neighbor = next[idx] ?? next[idx - 1] ?? null;
      nextActive = neighbor?.id ?? null;
    }
    set({ tabs: next, activeTabId: nextActive });
  },

  setActiveTab: (id) => set({ activeTabId: id }),
  setPaletteOpen: (open) => set({ paletteOpen: open }),
  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),
  setTheme: (theme) => {
    document.documentElement.dataset.theme = theme;
    set({ theme });
  },
  openNewSessionModal: () => set({ newSessionModalOpen: true }),
  closeNewSessionModal: () => set({ newSessionModalOpen: false }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  bumpSessionVersion: () =>
    set((s) => ({ sessionListVersion: s.sessionListVersion + 1 })),
}));
