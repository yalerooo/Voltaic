// SFTP tab: connection form, then a full file manager — breadcrumb path,
// directory listing, navigation, and file operations: upload (button or OS
// drag & drop), download, rename, copy/paste, delete, new folder, copy path.
// Transfers use the dialog plugin for local path selection.

import { useEffect, useRef, useState } from "react";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { ipc } from "../lib/ipc";
import { useFileDrop } from "../lib/useFileDrop";
import type { SftpEntry, SshConfig } from "../lib/types";
import { SshConnectForm } from "./SshConnectForm";
import { FileIcon } from "./FileIcon";
import { ContextMenu, type CtxItem, type CtxState } from "./ContextMenu";
import {
  IconUp,
  IconHome,
  IconRefresh,
  IconNewFolder,
  IconUpload,
  IconDownload,
  IconRename,
  IconCopy,
  IconPaste,
  IconTrash,
  IconLink,
} from "./icons";
import "./SftpBrowser.css";

const joinPath = (dir: string, name: string) => `${dir.replace(/\/$/, "")}/${name}`;
const basename = (p: string) => p.split(/[/\\]/).pop() ?? p;

export function SftpBrowser({ initialConfig }: { initialConfig?: SshConfig }) {
  const [id, setId] = useState<string | null>(null);
  const [home, setHome] = useState("/");
  const [cwd, setCwd] = useState("/");
  const [entries, setEntries] = useState<SftpEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<{ path: string; name: string } | null>(null);
  const [ctx, setCtx] = useState<CtxState | null>(null);

  const idRef = useRef<string | null>(null);
  const didAutoConnect = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    idRef.current = id;
  }, [id]);

  useEffect(() => {
    return () => {
      if (idRef.current) ipc.sftpDisconnect(idRef.current);
    };
  }, []);

  useEffect(() => {
    if (initialConfig && !didAutoConnect.current) {
      didAutoConnect.current = true;
      setConnecting(true);
      connect(initialConfig).catch((err) => {
        setConnectError(String(err));
        setConnecting(false);
      });
    }
  }, []); // run once on mount

  const refresh = async (sessionId: string, path: string) => {
    setError(null);
    try {
      const list = await ipc.sftpList(sessionId, path);
      setEntries(list);
      setCwd(path);
    } catch (e) {
      setError(String(e));
    }
  };

  const connect = async (config: SshConfig) => {
    setConnectError(null);
    setConnecting(true);
    const conn = await ipc.sftpConnect(config);
    setId(conn.id);
    setHome(conn.home);
    setConnecting(false);
    await refresh(conn.id, conn.home);
  };

  // ---- operations ----

  const navigate = (entry: SftpEntry) => {
    if (id && entry.kind === "dir") refresh(id, entry.path);
  };

  const goUp = () => {
    if (!id) return;
    const parent = cwd.replace(/\/[^/]+\/?$/, "") || "/";
    refresh(id, parent);
  };

  const guard = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const download = (entry: SftpEntry) =>
    guard(async () => {
      const dest = await saveDialog({ defaultPath: entry.name });
      if (dest && id) await ipc.sftpDownload(id, entry.path, dest);
    });

  const uploadDialog = () =>
    guard(async () => {
      const src = await openDialog({ multiple: true });
      if (!src || !id) return;
      const paths = Array.isArray(src) ? src : [src];
      for (const p of paths) await ipc.sftpUpload(id, p, joinPath(cwd, basename(p)));
      await refresh(id, cwd);
    });

  const uploadPaths = (paths: string[]) =>
    guard(async () => {
      if (!id) return;
      for (const p of paths) await ipc.sftpUpload(id, p, joinPath(cwd, basename(p)));
      await refresh(id, cwd);
    });

  const mkdir = () =>
    guard(async () => {
      const name = window.prompt("New folder name");
      if (name?.trim() && id) {
        await ipc.sftpMkdir(id, joinPath(cwd, name.trim()));
        await refresh(id, cwd);
      }
    });

  const rename = (entry: SftpEntry) =>
    guard(async () => {
      const name = window.prompt("Rename to:", entry.name);
      if (name?.trim() && name.trim() !== entry.name && id) {
        await ipc.sftpRename(id, entry.path, joinPath(cwd, name.trim()));
        await refresh(id, cwd);
      }
    });

  const remove = (entry: SftpEntry) =>
    guard(async () => {
      if (!window.confirm(`Delete "${entry.name}"?`) || !id) return;
      await ipc.sftpRemove(id, entry.path, entry.kind === "dir");
      await refresh(id, cwd);
    });

  const paste = () =>
    guard(async () => {
      if (!clipboard || !id) return;
      let target = joinPath(cwd, clipboard.name);
      if (target === clipboard.path) {
        const dot = clipboard.name.lastIndexOf(".");
        const stem = dot > 0 ? clipboard.name.slice(0, dot) : clipboard.name;
        const ext = dot > 0 ? clipboard.name.slice(dot) : "";
        target = joinPath(cwd, `${stem} copy${ext}`);
      }
      await ipc.sftpCopy(id, clipboard.path, target);
      await refresh(id, cwd);
    });

  const copyPath = (entry: SftpEntry) => {
    navigator.clipboard?.writeText(entry.path).catch(() => {});
  };

  const openRowMenu = (entry: SftpEntry, x: number, y: number) => {
    const items: CtxItem[] = [
      entry.kind === "dir"
        ? { kind: "action", label: "Open", icon: <IconUp />, onClick: () => navigate(entry) }
        : { kind: "action", label: "Download", icon: <IconDownload />, onClick: () => download(entry) },
      { kind: "action", label: "Rename", icon: <IconRename />, onClick: () => rename(entry) },
      ...(entry.kind === "file"
        ? [
            {
              kind: "action" as const,
              label: "Copy",
              icon: <IconCopy />,
              onClick: () => setClipboard({ path: entry.path, name: entry.name }),
            },
          ]
        : []),
      ...(clipboard
        ? [{ kind: "action" as const, label: `Paste "${clipboard.name}"`, icon: <IconPaste />, onClick: paste }]
        : []),
      { kind: "action", label: "Copy path", icon: <IconLink />, onClick: () => copyPath(entry) },
      { kind: "sep" },
      { kind: "action", label: "Delete", danger: true, icon: <IconTrash />, onClick: () => remove(entry) },
    ];
    setCtx({ x, y, items });
  };

  const isOver = useFileDrop(listRef, !!id, uploadPaths);

  if (connecting) {
    return <div className="sftp__connecting">Connecting…</div>;
  }

  if (!id) {
    return (
      <SshConnectForm
        title={initialConfig ? "Reconnect SFTP" : "New SFTP session"}
        cta="Connect"
        onConnect={connect}
        initialConfig={initialConfig}
        externalError={connectError}
      />
    );
  }

  return (
    <div className="sftp">
      <div className="sftp__toolbar">
        <button className="sftp__btn" onClick={() => refresh(id, home)} title="Home">
          <IconHome />
        </button>
        <button className="sftp__btn" onClick={goUp} disabled={cwd === "/"} title="Up one level">
          <IconUp />
        </button>
        <button className="sftp__btn" onClick={() => refresh(id, cwd)} title="Refresh">
          <IconRefresh />
        </button>
        <code className="sftp__path" title={cwd}>
          {cwd}
        </code>
        <div className="sftp__spacer" />
        {clipboard && (
          <button className="sftp__btn" onClick={paste} disabled={busy} title={`Paste "${clipboard.name}"`}>
            <IconPaste />
          </button>
        )}
        <button className="sftp__btn" onClick={mkdir} disabled={busy} title="New folder">
          <IconNewFolder />
        </button>
        <button className="sftp__btn sftp__btn--primary" onClick={uploadDialog} disabled={busy}>
          <IconUpload size={15} />
          Upload
        </button>
      </div>

      {error && <p className="sftp__error">{error}</p>}

      <div
        ref={listRef}
        className={`sftp__list${isOver ? " is-drop" : ""}`}
        onContextMenu={(e) => {
          if (e.target === e.currentTarget) {
            e.preventDefault();
            const items: CtxItem[] = [
              { kind: "action", label: "New folder", icon: <IconNewFolder />, onClick: mkdir },
              { kind: "action", label: "Upload files…", icon: <IconUpload />, onClick: uploadDialog },
              ...(clipboard
                ? [{ kind: "action" as const, label: `Paste "${clipboard.name}"`, icon: <IconPaste />, onClick: paste }]
                : []),
              { kind: "sep" },
              { kind: "action", label: "Refresh", icon: <IconRefresh />, onClick: () => refresh(id, cwd) },
            ];
            setCtx({ x: e.clientX, y: e.clientY, items });
          }
        }}
      >
        <div className="sftp__head">
          <span>Name</span>
          <span>Size</span>
          <span />
        </div>
        {entries.map((entry) => (
          <div
            key={entry.path}
            className="sftp__row"
            onDoubleClick={() => navigate(entry)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openRowMenu(entry, e.clientX, e.clientY);
            }}
          >
            <span className="sftp__name">
              <span className="sftp__icon">
                <FileIcon name={entry.name} kind={entry.kind} size={18} />
              </span>
              {entry.name}
            </span>
            <span className="sftp__size">
              {entry.kind === "dir" ? "—" : formatSize(entry.size)}
            </span>
            <span className="sftp__actions">
              {entry.kind !== "dir" && (
                <button className="sftp__link" onClick={() => download(entry)}>
                  Download
                </button>
              )}
              <button className="sftp__link sftp__link--danger" onClick={() => remove(entry)}>
                Delete
              </button>
            </span>
          </div>
        ))}
        {entries.length === 0 && <p className="sftp__empty">Empty directory</p>}

        {isOver && <div className="sftp__drop-hint">Drop files to upload to {cwd}</div>}
      </div>

      {ctx && <ContextMenu x={ctx.x} y={ctx.y} items={ctx.items} onClose={() => setCtx(null)} />}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes / 1024;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(1)} ${units[i]}`;
}
