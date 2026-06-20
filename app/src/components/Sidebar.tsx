import { useCallback, useEffect, useRef, useState } from "react";
import { ipc, isTauri } from "../lib/ipc";
import type {
  DockerConfig,
  FtpConfig,
  KubernetesConfig,
  Protocol,
  RdpConfig,
  SerialConfig,
  Session,
  SshConfig,
  VncConfig,
} from "../lib/types";
import { clearSecrets, injectSecrets } from "../lib/secrets";
import { exportSessions, importSessions } from "../lib/sessionTransfer";
import { useAppStore } from "../store/appStore";
import { SidebarFiles } from "./SidebarFiles";
import {
  IconCollapse,
  IconDownload,
  IconExpand,
  IconFolder,
  IconNewFolder,
  IconRefresh,
  IconSearch,
  IconSort,
  IconStar,
  IconUpload,
} from "./icons";
import { ContextMenu, type CtxItem, type CtxState } from "./ContextMenu";
import "./Sidebar.css";

// ---- Protocol dot color ----

const PROTO_COLOR: Partial<Record<Protocol, string>> = {
  local_shell: "var(--color-primary)",
  ssh: "var(--color-success)",
  sftp: "var(--color-info)",
  ftp: "hsl(199 70% 55%)",
  rdp: "hsl(280 65% 60%)",
  vnc: "hsl(30 90% 55%)",
  serial: "hsl(180 60% 48%)",
  mosh: "hsl(160 60% 48%)",
  docker: "hsl(199 85% 55%)",
  kubernetes: "hsl(230 70% 62%)",
};

function ProtoDot({ protocol }: { protocol: Protocol }) {
  return (
    <span
      className="sb-session__dot"
      style={{ background: PROTO_COLOR[protocol] ?? "var(--color-muted-soft)" }}
    />
  );
}

// ---- Session row ----

function SessionRow({
  session,
  isEditing,
  dragging,
  onOpen,
  onMenuOpen,
  onRename,
  onStartRename,
  onToggleFavorite,
  onDragStart,
}: {
  session: Session;
  isEditing: boolean;
  dragging: boolean;
  onOpen: () => void;
  onMenuOpen: (x: number, y: number) => void;
  onRename: (newName: string) => void;
  onStartRename: () => void;
  onToggleFavorite: () => void;
  onDragStart: (e: React.MouseEvent) => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(session.name);

  useEffect(() => {
    if (isEditing) {
      setDraft(session.name);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [isEditing, session.name]);

  const submit = () => {
    const name = draft.trim();
    onRename(name || session.name);
  };

  const handleKeyDownInput = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onRename(session.name); // cancel by sending same name
    }
  };

  const handleKeyDownMain = (e: React.KeyboardEvent) => {
    if (e.key === "F2") {
      e.preventDefault();
      onStartRename();
    }
  };

  const handleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    const r = btnRef.current?.getBoundingClientRect();
    if (r) onMenuOpen(r.right + 4, r.top);
  };

  const handleCtx = (e: React.MouseEvent) => {
    e.preventDefault();
    onMenuOpen(e.clientX, e.clientY);
  };


  if (isEditing) {
    return (
      <div className="sb-session sb-session--editing">
        <ProtoDot protocol={session.protocol} />
        <input
          ref={inputRef}
          className="sb-session__edit"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDownInput}
          onBlur={submit}
        />
      </div>
    );
  }

  return (
    <div
      className={`sb-session${dragging ? " is-dragging" : ""}`}
      onContextMenu={handleCtx}
      // Cancel any native text/element drag so it can't steal pointer tracking.
      onDragStart={(e) => e.preventDefault()}
    >
      <button
        className="sb-session__main"
        onClick={onOpen}
        onKeyDown={handleKeyDownMain}
        onMouseDown={onDragStart}
      >
        <ProtoDot protocol={session.protocol} />
        <span className="sb-session__name">{session.name}</span>
      </button>
      <button
        className={`sb-session__star-btn${session.favorite ? " is-fav" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        title={session.favorite ? "Remove from favorites" : "Add to favorites"}
        aria-pressed={session.favorite}
      >
        {session.favorite ? "★" : "☆"}
      </button>
      <button
        ref={btnRef}
        className="sb-session__more"
        onClick={handleMenu}
        title="More options"
      >
        ⋮
      </button>
    </div>
  );
}

// ---- Folder node ----

function FolderNode({
  name,
  sessions,
  open,
  color,
  isDropTarget,
  draggingId,
  isRenaming,
  onToggle,
  editingId,
  onOpen,
  onSessionMenu,
  onFolderMenu,
  onRename,
  onStartRename,
  onToggleFavorite,
  onSessionDragStart,
  onRenameFolder,
}: {
  name: string;
  sessions: Session[];
  open: boolean;
  color?: string;
  isDropTarget: boolean;
  draggingId: string | null;
  isRenaming: boolean;
  onToggle: () => void;
  editingId: string | null;
  onOpen: (s: Session) => void;
  onSessionMenu: (s: Session, x: number, y: number) => void;
  onFolderMenu: (name: string, x: number, y: number) => void;
  onRename: (s: Session, newName: string) => void;
  onStartRename: (s: Session) => void;
  onToggleFavorite: (s: Session) => void;
  onSessionDragStart: (s: Session, e: React.MouseEvent) => void;
  onRenameFolder: (newName: string) => void;
}) {
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) {
      setDraft(name);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [isRenaming, name]);

  const submit = () => onRenameFolder(draft.trim() || name);

  return (
    <div className={`sb-folder${isDropTarget ? " is-dragover" : ""}`} data-folder={name}>
      {isRenaming ? (
        <div className="sb-folder__row sb-folder__row--editing">
          <span className="sb-folder__arrow" />
          <span className="sb-folder__icon" style={color ? { color } : undefined}>
            <IconFolder size={15} />
          </span>
          <input
            ref={inputRef}
            className="sb-folder__edit"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                onRenameFolder(name); // cancel
              }
            }}
            onBlur={submit}
          />
        </div>
      ) : (
        <button
          className="sb-folder__row"
          onClick={onToggle}
          onContextMenu={(e) => {
            e.preventDefault();
            onFolderMenu(name, e.clientX, e.clientY);
          }}
        >
          <span className={`sb-folder__arrow${open ? " is-open" : ""}`}>▶</span>
          <span className="sb-folder__icon" style={color ? { color } : undefined}>
            <IconFolder size={15} />
          </span>
          <span className="sb-folder__name">{name}</span>
          <span className="sb-folder__count">{sessions.length}</span>
        </button>
      )}
      {open && (
        <div className="sb-folder__children">
          {sessions.map((s) => (
            <SessionRow
              key={s.id}
              session={s}
              isEditing={editingId === s.id}
              dragging={draggingId === s.id}
              onOpen={() => onOpen(s)}
              onMenuOpen={(x, y) => onSessionMenu(s, x, y)}
              onRename={(name) => onRename(s, name)}
              onStartRename={() => onStartRename(s)}
              onToggleFavorite={() => onToggleFavorite(s)}
              onDragStart={(e) => onSessionDragStart(s, e)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Sidebar ----

type SidebarView = "sessions" | "files";
type SortMode = "name" | "recent" | "favorites";

const FOLDERS_KEY = "voltaic:folders";

function loadExtraFolders(): string[] {
  try {
    const raw = localStorage.getItem(FOLDERS_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveExtraFolders(folders: string[]) {
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
}

const COLORS_KEY = "voltaic:folder-colors";

function loadFolderColors(): Record<string, string> {
  try {
    const raw = localStorage.getItem(COLORS_KEY);
    const obj = raw ? (JSON.parse(raw) as unknown) : {};
    return obj && typeof obj === "object" ? (obj as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveFolderColors(map: Record<string, string>) {
  localStorage.setItem(COLORS_KEY, JSON.stringify(map));
}

// Palette offered for folder personalization (pastels + default yellow + white).
const FOLDER_COLORS: { value: string | null; label: string }[] = [
  { value: null, label: "Default" },
  { value: "#faff69", label: "Yellow" },
  { value: "#ffadcd", label: "Pink" },
  { value: "#a9d3ff", label: "Blue" },
  { value: "#aef2c5", label: "Green" },
  { value: "#ff9b9b", label: "Red" },
  { value: "#cdb8ff", label: "Purple" },
  { value: "#ffce9e", label: "Orange" },
  { value: "#ffffff", label: "White" },
];

function sortSessions(list: Session[], mode: SortMode): Session[] {
  const byName = (a: Session, b: Session) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
  const copy = [...list];
  if (mode === "recent") {
    copy.sort((a, b) => {
      const ta = a.last_used_at ? Date.parse(a.last_used_at) : 0;
      const tb = b.last_used_at ? Date.parse(b.last_used_at) : 0;
      return tb - ta || byName(a, b);
    });
  } else if (mode === "favorites") {
    copy.sort((a, b) => Number(b.favorite) - Number(a.favorite) || byName(a, b));
  } else {
    copy.sort(byName);
  }
  return copy;
}

const WIDTH_KEY = "voltaic:sidebar-width";
const MIN_WIDTH = 200;
const MAIN_MIN = 100; // minimum visible width for the main content area
const getMaxWidth = () =>
  typeof window !== "undefined" ? window.innerWidth - MAIN_MIN : 2000;

function useSidebarWidth() {
  const [width, setWidth] = useState(() => {
    const saved = Number(localStorage.getItem(WIDTH_KEY));
    const max = getMaxWidth();
    return saved >= MIN_WIDTH && saved <= max ? saved : 240;
  });
  const [resizing, setResizing] = useState(false);

  useEffect(() => {
    const onResize = () => {
      const max = getMaxWidth();
      if (width > max) {
        const next = Math.max(MIN_WIDTH, max);
        setWidth(next);
        localStorage.setItem(WIDTH_KEY, String(next));
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [width]);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setResizing(true);
    const startX = e.clientX;
    const startWidth = width;

    const onMove = (ev: MouseEvent) => {
      const max = getMaxWidth();
      const next = Math.max(MIN_WIDTH, Math.min(max, startWidth + (ev.clientX - startX)));
      setWidth(next);
    };
    const onUp = () => {
      setResizing(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setWidth((w) => {
        localStorage.setItem(WIDTH_KEY, String(w));
        return w;
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return { width, resizing, startResize };
}

export function Sidebar() {
  const openTab = useAppStore((s) => s.openTab);
  const openNewSessionModal = useAppStore((s) => s.openNewSessionModal);
  const sessionListVersion = useAppStore((s) => s.sessionListVersion);
  const bumpSessionVersion = useAppStore((s) => s.bumpSessionVersion);
  const tabs = useAppStore((s) => s.tabs);
  const activeTabId = useAppStore((s) => s.activeTabId);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [ctx, setCtx] = useState<CtxState | null>(null);
  const [view, setView] = useState<SidebarView>("sessions");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [transferMsg, setTransferMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("name");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [extraFolders, setExtraFolders] = useState<string[]>(() => loadExtraFolders());
  const [folderColors, setFolderColors] = useState<Record<string, string>>(() => loadFolderColors());
  // Pointer-based drag of a session onto a folder. (Tauri's native drag-drop
  // handler breaks HTML5 DnD inside the WebView2, so we track pointer events.)
  const [drag, setDrag] = useState<{ id: string; name: string } | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dropTarget, setDropTarget] = useState<string | null>(null); // folder name | "__root__" | null
  const suppressClickRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { width, resizing, startResize } = useSidebarWidth();

  // The machine shown in the main area, used to drive the Files browser.
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;
  const activeSsh =
    activeTab?.kind === "session" &&
    (activeTab.protocol === "ssh" || activeTab.protocol === "sftp")
      ? activeTab.sshConfig
      : undefined;

  // Auto-reveal the Files browser when the active tab becomes an SSH machine,
  // and fall back to the session list on tabs that aren't a remote machine.
  const lastTabId = useRef<string | null>(activeTabId);
  useEffect(() => {
    if (activeTabId === lastTabId.current) return;
    lastTabId.current = activeTabId;
    if (
      activeTab?.kind === "session" &&
      activeTab.protocol === "ssh" &&
      activeTab.sshConfig
    ) {
      setView("files");
    } else if (!activeSsh) {
      setView("sessions");
    }
  }, [activeTabId, activeTab, activeSsh]);

  const refresh = useCallback(() => {
    if (!isTauri) return;
    ipc.listSessions().then(setSessions).catch(() => setSessions([]));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, sessionListVersion]);

  // Focus the filter input the moment it is revealed.
  useEffect(() => {
    if (searchOpen) requestAnimationFrame(() => searchInputRef.current?.focus());
  }, [searchOpen]);

  // Persist the list of user-created (possibly empty) folders.
  const mutateExtraFolders = (fn: (prev: string[]) => string[]) => {
    setExtraFolders((prev) => {
      const next = fn(prev);
      saveExtraFolders(next);
      return next;
    });
  };

  // Persist folder colors. `color === null` clears the entry.
  const setFolderColor = (folder: string, color: string | null) => {
    setFolderColors((prev) => {
      const next = { ...prev };
      if (color) next[folder] = color;
      else delete next[folder];
      saveFolderColors(next);
      return next;
    });
  };

  // Start a pointer-driven drag from a session row. A real drag only begins once
  // the pointer moves past a small threshold, so plain clicks still open.
  const beginDrag = (s: Session, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const start = { x: e.clientX, y: e.clientY };
    let started = false;
    let target: string | null = null;

    // Resolve the drop target under a screen point by hit-testing the folder
    // rectangles directly (deterministic; avoids WebView elementFromPoint
    // quirks with the floating ghost / stacking).
    const hit = (el: Element | null, x: number, y: number) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };
    const resolveTarget = (x: number, y: number): string | null => {
      for (const el of document.querySelectorAll<HTMLElement>("[data-folder]")) {
        if (hit(el, x, y)) return el.getAttribute("data-folder");
      }
      return hit(document.querySelector("[data-droproot]"), x, y) ? "__root__" : null;
    };

    const onMove = (ev: MouseEvent) => {
      if (!started) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 5) return;
        started = true;
        setDrag({ id: s.id, name: s.name });
      }
      setGhost({ x: ev.clientX, y: ev.clientY });
      target = resolveTarget(ev.clientX, ev.clientY);
      setDropTarget(target);
    };

    const onUp = (ev: MouseEvent) => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (started) {
        suppressClickRef.current = true; // swallow the click that follows the drop
        // Recompute at the exact release point; fall back to the last hover.
        const dropped = resolveTarget(ev.clientX, ev.clientY) ?? target;
        const dest = dropped === "__root__" ? null : dropped;
        if (dropped && (s.folder_id ?? null) !== dest) {
          updateSession({ ...s, folder_id: dest });
          if (dest) {
            // Expand the destination folder so the moved session is visible.
            setCollapsed((prev) => {
              if (!prev.has(dest)) return prev;
              const next = new Set(prev);
              next.delete(dest);
              return next;
            });
          }
        }
      }
      setDrag(null);
      setDropTarget(null);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Open a session, unless the click is the tail end of a drag gesture.
  const handleOpen = (s: Session) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    openSession(s);
  };

  const openSession = async (s: Session) => {
    // Resolve any keychain-stored credentials back into the config before
    // handing it to the live tab.
    const resolved = isTauri ? await injectSecrets(s) : s;
    const opts = resolved.options as Record<string, unknown>;
    const sshCfg = opts?.sshConfig as SshConfig | undefined;
    const serialCfg = opts?.serialConfig as SerialConfig | undefined;
    const rdpCfg = opts?.rdpConfig as RdpConfig | undefined;
    const vncCfg = opts?.vncConfig as VncConfig | undefined;
    const ftpCfg = opts?.ftpConfig as FtpConfig | undefined;
    const dockerCfg = opts?.dockerConfig as DockerConfig | undefined;
    const kubernetesCfg = opts?.kubernetesConfig as KubernetesConfig | undefined;
    openTab({
      title: s.name,
      kind: "session",
      protocol: s.protocol,
      sshConfig: sshCfg,
      serialConfig: serialCfg,
      rdpConfig: rdpCfg,
      vncConfig: vncCfg,
      ftpConfig: ftpCfg,
      dockerConfig: dockerCfg,
      kubernetesConfig: kubernetesCfg,
    });
  };

  const deleteSession = async (s: Session) => {
    if (!isTauri) return;
    await ipc.deleteSession(s.id);
    await clearSecrets(s.id);
    bumpSessionVersion();
    refresh();
  };

  // Show a transient status under the action buttons (auto-clears).
  const flash = (msg: string) => {
    setTransferMsg(msg);
    window.setTimeout(() => setTransferMsg(null), 4000);
  };

  const doImport = async () => {
    if (!isTauri) return;
    try {
      const n = await importSessions();
      if (n === null) return; // cancelled
      bumpSessionVersion();
      refresh();
      flash(n ? `Imported ${n} session${n === 1 ? "" : "s"}` : "No sessions found");
    } catch (e) {
      flash(`Import failed: ${e}`);
    }
  };

  const doExport = async () => {
    if (!isTauri) return;
    try {
      const n = await exportSessions();
      if (n === null) return; // cancelled
      flash(`Exported ${n} session${n === 1 ? "" : "s"}`);
    } catch (e) {
      flash(`Export failed: ${e}`);
    }
  };

  const updateSession = async (updated: Session) => {
    if (!isTauri) return;
    await ipc.saveSession(updated);
    bumpSessionVersion();
    refresh();
  };

  const moveToFolder = (s: Session, folder: string | null) =>
    updateSession({ ...s, folder_id: folder });

  const toggleFavorite = (s: Session) => updateSession({ ...s, favorite: !s.favorite });

  const renameSession = (s: Session) => {
    setEditingId(s.id);
  };

  const finishRename = async (s: Session, newName: string) => {
    setEditingId(null);
    if (newName === s.name) return;
    await updateSession({ ...s, name: newName });
  };

  const openSessionMenu = (s: Session, x: number, y: number) => {
    const folders = [
      ...new Set(sessions.map((se) => se.folder_id).filter(Boolean)),
    ] as string[];
    const otherFolders = folders.filter((f) => f !== s.folder_id);

    const items: CtxItem[] = [
      { kind: "action", label: "Open", onClick: () => openSession(s) },
      {
        kind: "action",
        label: s.favorite ? "Remove from favorites" : "Add to favorites",
        icon: <IconStar />,
        onClick: () => updateSession({ ...s, favorite: !s.favorite }),
      },
      { kind: "sep" },
      { kind: "action", label: "Rename", onClick: () => { setCtx(null); renameSession(s); } },
      ...(s.folder_id
        ? [
            {
              kind: "action" as const,
              label: "Remove from folder",
              onClick: () => moveToFolder(s, null),
            },
          ]
        : []),
      ...otherFolders.map((f) => ({
        kind: "action" as const,
        label: `Move to "${f}"`,
        onClick: () => moveToFolder(s, f),
      })),
      {
        kind: "action" as const,
        label: "Move to new folder…",
        onClick: () => {
          const name = window.prompt("Folder name:");
          if (name?.trim()) moveToFolder(s, name.trim());
        },
      },
      { kind: "sep" },
      {
        kind: "action" as const,
        danger: true,
        label: "Delete",
        onClick: () => deleteSession(s),
      },
    ];
    setCtx({ x, y, items });
  };

  const openFolderMenu = (folder: string, x: number, y: number) => {
    const items: CtxItem[] = [
      {
        kind: "swatches",
        label: "Folder color",
        colors: FOLDER_COLORS,
        current: folderColors[folder] ?? null,
        onPick: (value) => setFolderColor(folder, value),
      },
      { kind: "sep" },
      {
        kind: "action",
        label: "Rename folder",
        onClick: () => {
          setCtx(null);
          setEditingFolder(folder);
        },
      },
      { kind: "sep" },
      {
        kind: "action",
        danger: true,
        label: "Delete folder (keep sessions)",
        onClick: async () => {
          const toMove = sessions.filter((s) => s.folder_id === folder);
          for (const s of toMove) {
            await ipc.saveSession({ ...s, folder_id: null });
          }
          mutateExtraFolders((prev) => prev.filter((f) => f !== folder));
          setFolderColor(folder, null);
          bumpSessionVersion();
          refresh();
        },
      },
    ];
    setCtx({ x, y, items });
  };

  // ---- Quick-access toolbar handlers ----

  const newFolder = () => {
    const name = window.prompt("New folder name:")?.trim();
    if (name) mutateExtraFolders((prev) => (prev.includes(name) ? prev : [...prev, name]));
  };

  // Commit an inline folder rename: move its sessions, and carry over the
  // folder's color, collapsed state, and empty-folder entry to the new name.
  const finishFolderRename = async (oldName: string, rawNew: string) => {
    setEditingFolder(null);
    const name = rawNew.trim();
    if (!name || name === oldName) return;
    const toMove = sessions.filter((s) => s.folder_id === oldName);
    for (const s of toMove) {
      await ipc.saveSession({ ...s, folder_id: name });
    }
    mutateExtraFolders((prev) =>
      prev.includes(oldName) ? [...new Set(prev.map((f) => (f === oldName ? name : f)))] : prev,
    );
    const color = folderColors[oldName];
    if (color) {
      setFolderColor(oldName, null);
      setFolderColor(name, color);
    }
    setCollapsed((prev) => {
      if (!prev.has(oldName)) return prev;
      const next = new Set(prev);
      next.delete(oldName);
      next.add(name);
      return next;
    });
    bumpSessionVersion();
    refresh();
  };

  const toggleFolder = (folder: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      return next;
    });
  };

  const openSortMenu = (x: number, y: number) => {
    const opt = (mode: SortMode, label: string): CtxItem => ({
      kind: "action",
      label: `${sortMode === mode ? "✓ " : "   "}${label}`,
      onClick: () => setSortMode(mode),
    });
    setCtx({
      x,
      y,
      items: [
        opt("name", "Name (A–Z)"),
        opt("recent", "Recently used"),
        opt("favorites", "Favorites first"),
      ],
    });
  };

  // ---- Filtered + sorted view of the session tree ----

  const q = search.trim().toLowerCase();
  const matches = (s: Session) =>
    (!favoritesOnly || s.favorite) && (!q || s.name.toLowerCase().includes(q));
  const filtered = sessions.filter(matches);

  // Show user-created (possibly empty) folders only when not actively filtering.
  const showExtras = !q && !favoritesOnly;
  const folders = [
    ...new Set([
      ...filtered.map((s) => s.folder_id).filter(Boolean),
      ...(showExtras ? extraFolders : []),
    ]),
  ].sort((a, b) => (a as string).localeCompare(b as string)) as string[];
  const unfiled = sortSessions(filtered.filter((s) => !s.folder_id), sortMode);

  // When filtering, force folders open so matches are visible.
  const isFolderOpen = (folder: string) => (q ? true : !collapsed.has(folder));
  const allCollapsed = folders.length > 0 && folders.every((f) => collapsed.has(f));
  const toggleAllFolders = () =>
    setCollapsed(allCollapsed ? new Set() : new Set(folders));

  return (
    <nav
      className="sidebar"
      style={{ width, flexBasis: width, userSelect: resizing || drag ? "none" : undefined }}
    >
      <div
        className={`sidebar__resize-handle${resizing ? " is-active" : ""}`}
        onMouseDown={startResize}
      />
      {/* Two tabs: the saved-machine list and the SFTP browser of the active one. */}
      <div className="sidebar__tabs" role="tablist">
        <button
          role="tab"
          aria-selected={view === "sessions"}
          className={`sidebar__tab${view === "sessions" ? " is-active" : ""}`}
          onClick={() => setView("sessions")}
        >
          Sessions
        </button>
        <button
          role="tab"
          aria-selected={view === "files"}
          className={`sidebar__tab${view === "files" ? " is-active" : ""}`}
          onClick={() => setView("files")}
        >
          Files
          {activeSsh && <span className="sidebar__tab-dot" />}
        </button>
      </div>

      {/* Sessions view */}
      <div
        className="sidebar__view"
        style={{ display: view === "sessions" ? "flex" : "none" }}
      >
        <div className="sidebar__top">
          <button className="sidebar__btn-new" onClick={openNewSessionModal}>
            <span className="sidebar__btn-plus">＋</span>
            New Session
          </button>
          {/* Quick-access toolbar. */}
          <div className="sidebar__quickbar">
            <button
              className={`sidebar__quick-btn${searchOpen ? " is-active" : ""}`}
              onClick={() => setSearchOpen((o) => !o)}
              title="Search sessions"
            >
              <IconSearch size={13} />
            </button>
            <button
              className={`sidebar__quick-btn${favoritesOnly ? " is-active" : ""}`}
              onClick={() => setFavoritesOnly((v) => !v)}
              title="Favorites only"
            >
              <IconStar size={13} />
            </button>
            <button
              className={`sidebar__quick-btn${sortMode !== "name" ? " is-active" : ""}`}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                openSortMenu(r.left, r.bottom + 4);
              }}
              title="Sort sessions"
            >
              <IconSort size={13} />
            </button>
            <button className="sidebar__quick-btn" onClick={newFolder} title="New folder">
              <IconNewFolder size={13} />
            </button>
            <button
              className="sidebar__quick-btn"
              onClick={toggleAllFolders}
              disabled={folders.length === 0}
              title={allCollapsed ? "Expand all folders" : "Collapse all folders"}
            >
              {allCollapsed ? <IconExpand size={13} /> : <IconCollapse size={13} />}
            </button>
            <button className="sidebar__quick-btn" onClick={() => refresh()} title="Refresh">
              <IconRefresh size={13} />
            </button>
            <span className="sidebar__quick-sep" />
            <button className="sidebar__quick-btn" onClick={doImport} title="Import sessions">
              <IconDownload size={13} />
            </button>
            <button className="sidebar__quick-btn" onClick={doExport} title="Export sessions">
              <IconUpload size={13} />
            </button>
          </div>

          {searchOpen && (
            <input
              ref={searchInputRef}
              className="sidebar__search"
              placeholder="Filter sessions…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSearch("");
                  setSearchOpen(false);
                }
              }}
            />
          )}
          {transferMsg && <span className="sidebar__top-msg">{transferMsg}</span>}
        </div>

        <div
          className={`sidebar__tree${dropTarget === "__root__" ? " is-dragover-root" : ""}`}
          data-droproot
        >
          {sessions.length === 0 ? (
            <div className="sidebar__empty">
              <p>No saved sessions yet.</p>
              <button className="sidebar__empty-cta" onClick={openNewSessionModal}>
                + Add your first session
              </button>
            </div>
          ) : folders.length === 0 && unfiled.length === 0 ? (
            <div className="sidebar__empty">
              <p>{favoritesOnly || q ? "No matching sessions." : "No sessions."}</p>
            </div>
          ) : (
            <>
              {folders.map((folder) => (
                <FolderNode
                  key={folder}
                  name={folder}
                  sessions={sortSessions(
                    filtered.filter((s) => s.folder_id === folder),
                    sortMode,
                  )}
                  open={isFolderOpen(folder)}
                  color={folderColors[folder]}
                  isDropTarget={dropTarget === folder}
                  draggingId={drag?.id ?? null}
                  isRenaming={editingFolder === folder}
                  onToggle={() => toggleFolder(folder)}
                  editingId={editingId}
                  onOpen={handleOpen}
                  onSessionMenu={openSessionMenu}
                  onFolderMenu={openFolderMenu}
                  onRename={finishRename}
                  onStartRename={renameSession}
                  onToggleFavorite={toggleFavorite}
                  onSessionDragStart={beginDrag}
                  onRenameFolder={(newName) => finishFolderRename(folder, newName)}
                />
              ))}
              {unfiled.map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  isEditing={editingId === s.id}
                  dragging={drag?.id === s.id}
                  onOpen={() => handleOpen(s)}
                  onMenuOpen={(x, y) => openSessionMenu(s, x, y)}
                  onRename={(name) => finishRename(s, name)}
                  onStartRename={() => renameSession(s)}
                  onToggleFavorite={() => toggleFavorite(s)}
                  onDragStart={(e) => beginDrag(s, e)}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* Files view (kept mounted so the SFTP connection survives tab flips). */}
      <div
        className="sidebar__view"
        style={{ display: view === "files" ? "flex" : "none" }}
      >
        <SidebarFiles
          active={view === "files"}
          sshConfig={activeSsh}
          sessionKey={activeSsh ? activeTabId : null}
          sessionTitle={activeTab?.title}
        />
      </div>

      {ctx && (
        <ContextMenu
          x={ctx.x}
          y={ctx.y}
          items={ctx.items}
          onClose={() => setCtx(null)}
        />
      )}

      {drag && (
        <div
          className="sb-drag-ghost"
          style={{ left: ghost.x + 12, top: ghost.y + 8 }}
        >
          {drag.name}
        </div>
      )}
    </nav>
  );
}
