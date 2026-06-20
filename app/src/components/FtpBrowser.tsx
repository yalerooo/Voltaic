// FTP tab: a connection form, then a file manager (navigate, upload via button
// or OS drag & drop, download, rename, delete, new folder, copy path). Mirrors
// the SFTP browser's look (reuses its styles) but speaks classic FTP. FTP has no
// server-side copy, so copy/paste is omitted.

import { useEffect, useRef, useState } from "react";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { ipc } from "../lib/ipc";
import { useFileDrop } from "../lib/useFileDrop";
import type { FtpConfig, FtpEntry } from "../lib/types";
import { FileIcon } from "./FileIcon";
import { ContextMenu, type CtxItem, type CtxState } from "./ContextMenu";
import { IconUp, IconHome, IconRefresh, IconNewFolder, IconUpload, IconDownload, IconRename, IconTrash, IconLink } from "./icons";
import "./SftpBrowser.css";
import "./RdpView.css";

const joinPath = (dir: string, name: string) => `${dir.replace(/\/$/, "")}/${name}`;
const basename = (p: string) => p.split(/[/\\]/).pop() ?? p;

export function FtpBrowser({ initialConfig }: { initialConfig?: FtpConfig }) {
  const [id, setId] = useState<string | null>(null);
  const [home, setHome] = useState("/");
  const [cwd, setCwd] = useState("/");
  const [entries, setEntries] = useState<FtpEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [ctx, setCtx] = useState<CtxState | null>(null);

  const idRef = useRef<string | null>(null);
  const didAuto = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    idRef.current = id;
  }, [id]);

  useEffect(() => {
    return () => {
      if (idRef.current) ipc.ftpDisconnect(idRef.current);
    };
  }, []);

  useEffect(() => {
    if (initialConfig && !didAuto.current) {
      didAuto.current = true;
      setConnecting(true);
      connect(initialConfig).catch((e) => {
        setConnectError(String(e));
        setConnecting(false);
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = async (sessionId: string, path: string) => {
    setError(null);
    try {
      const list = await ipc.ftpList(sessionId, path);
      setEntries(list);
      setCwd(path);
    } catch (e) {
      setError(String(e));
    }
  };

  const connect = async (config: FtpConfig) => {
    setConnectError(null);
    setConnecting(true);
    const conn = await ipc.ftpConnect(config);
    setId(conn.id);
    setHome(conn.home);
    setConnecting(false);
    await refresh(conn.id, conn.home);
  };

  const navigate = (entry: FtpEntry) => {
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

  const download = (entry: FtpEntry) =>
    guard(async () => {
      const dest = await saveDialog({ defaultPath: entry.name });
      if (dest && id) await ipc.ftpDownload(id, entry.path, dest);
    });

  const uploadDialog = () =>
    guard(async () => {
      const src = await openDialog({ multiple: true });
      if (!src || !id) return;
      const paths = Array.isArray(src) ? src : [src];
      for (const p of paths) await ipc.ftpUpload(id, p, joinPath(cwd, basename(p)));
      await refresh(id, cwd);
    });

  const uploadPaths = (paths: string[]) =>
    guard(async () => {
      if (!id) return;
      for (const p of paths) await ipc.ftpUpload(id, p, joinPath(cwd, basename(p)));
      await refresh(id, cwd);
    });

  const mkdir = () =>
    guard(async () => {
      const name = window.prompt("New folder name");
      if (name?.trim() && id) {
        await ipc.ftpMkdir(id, joinPath(cwd, name.trim()));
        await refresh(id, cwd);
      }
    });

  const rename = (entry: FtpEntry) =>
    guard(async () => {
      const name = window.prompt("Rename to:", entry.name);
      if (name?.trim() && name.trim() !== entry.name && id) {
        await ipc.ftpRename(id, entry.path, joinPath(cwd, name.trim()));
        await refresh(id, cwd);
      }
    });

  const remove = (entry: FtpEntry) =>
    guard(async () => {
      if (!window.confirm(`Delete "${entry.name}"?`) || !id) return;
      await ipc.ftpRemove(id, entry.path, entry.kind === "dir");
      await refresh(id, cwd);
    });

  const copyPath = (entry: FtpEntry) => {
    navigator.clipboard?.writeText(entry.path).catch(() => {});
  };

  const openRowMenu = (entry: FtpEntry, x: number, y: number) => {
    const items: CtxItem[] = [
      entry.kind === "dir"
        ? { kind: "action", label: "Open", icon: <IconUp />, onClick: () => navigate(entry) }
        : { kind: "action", label: "Download", icon: <IconDownload />, onClick: () => download(entry) },
      { kind: "action", label: "Rename", icon: <IconRename />, onClick: () => rename(entry) },
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
      <FtpConnectForm
        initialConfig={initialConfig}
        error={connectError}
        onConnect={(c) => connect(c).catch((e) => setConnectError(String(e)))}
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
        <button className="sftp__btn" onClick={mkdir} disabled={busy} title="New folder">
          <IconNewFolder />
        </button>
        <button className="sftp__btn sftp__btn--primary" onClick={uploadDialog} disabled={busy}>
          <IconUpload size={15} />
          Upload
        </button>
      </div>

      {error && <p className="sftp__error">{error}</p>}

      <div ref={listRef} className={`sftp__list${isOver ? " is-drop" : ""}`}>
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
              openRowMenu(entry, e.clientX, e.clientY);
            }}
          >
            <span className="sftp__name">
              <span className="sftp__icon">
                <FileIcon name={entry.name} kind={entry.kind} size={18} />
              </span>
              {entry.name}
            </span>
            <span className="sftp__size">{entry.kind === "dir" ? "—" : formatSize(entry.size)}</span>
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

function FtpConnectForm({
  initialConfig,
  error,
  onConnect,
}: {
  initialConfig?: FtpConfig;
  error: string | null;
  onConnect: (config: FtpConfig) => void;
}) {
  const [host, setHost] = useState(initialConfig?.host ?? "");
  const [port, setPort] = useState(initialConfig?.port ?? 21);
  const [username, setUsername] = useState(initialConfig?.username ?? "anonymous");
  const [password, setPassword] = useState(initialConfig?.password ?? "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onConnect({ host, port, username, password });
  };

  return (
    <div className="rdp-connect">
      <form className="rdp-connect__card" onSubmit={submit}>
        <h2 className="rdp-connect__title">New FTP session</h2>
        <div className="rdp-connect__row">
          <label className="rdp-connect__field rdp-connect__field--grow">
            <span>Host</span>
            <input
              className="rdp-connect__input"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="ftp.example.com"
              required
              autoFocus
            />
          </label>
          <label className="rdp-connect__field rdp-connect__field--port">
            <span>Port</span>
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
          <span>Username</span>
          <input
            className="rdp-connect__input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label className="rdp-connect__field">
          <span>Password</span>
          <input
            className="rdp-connect__input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="rdp-connect__error">{error}</p>}
        <button className="rdp-connect__submit" type="submit">
          Connect
        </button>
      </form>
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
