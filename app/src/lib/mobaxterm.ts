// Read/write the MobaXterm `.mxtsessions` session format (an INI-like file) so
// users can import existing sessions and export ours to the same format.
//
// Layout: sessions are grouped under [Bookmarks] / [Bookmarks_N] sections. Each
// section has `SubRep=<folder>` and `ImgNum=<n>`; every other `Name= #..#..`
// line is a session whose value encodes the protocol type and parameters,
// `%`-separated, with `#`-separated parameter groups.
//
//   Name= #<type>#<icon>%<host>%<port>%<user>%...more...
//
// Type ids: 0=SSH, 4=RDP, 5=VNC, 6=FTP, 7=SFTP, 8=Serial. Passwords are never
// stored in this file (MobaXterm keeps them separately, as do we — see the
// keychain integration), so credentials are not transferred.

import type { Session } from "./types";

const TYPE_TO_PROTOCOL: Record<number, string> = {
  0: "ssh",
  4: "rdp",
  5: "vnc",
  6: "ftp",
  7: "sftp",
  8: "serial",
};

const PROTOCOL_TO_TYPE: Record<string, number> = {
  ssh: 0,
  sftp: 0, // MobaXterm exposes SFTP through its SSH sessions.
  rdp: 4,
  vnc: 5,
  ftp: 6,
  serial: 8,
};

const DEFAULT_PORT: Record<string, number> = {
  ssh: 22,
  sftp: 22,
  rdp: 3389,
  vnc: 5900,
  ftp: 21,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Opts = Record<string, any>;

// ---- Import ----

/** Parse a `.mxtsessions` file into Session objects (no passwords). */
export function parseMxtSessions(text: string): Session[] {
  const out: Session[] = [];
  let folder: string | null = null;
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith(";")) continue;
    if (/^\[Bookmarks(_\d+)?\]$/i.test(line)) {
      folder = null; // reset; the section's SubRep sets the folder
      continue;
    }
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();

    if (/^SubRep$/i.test(key)) {
      folder = value ? value.replace(/\\/g, "/") : null;
      continue;
    }
    if (/^ImgNum$/i.test(key)) continue;
    if (!value.startsWith("#")) continue;

    const m = /^#(\d+)#(.*)$/.exec(value);
    if (!m) continue;
    const protocol = TYPE_TO_PROTOCOL[parseInt(m[1], 10)];
    if (!protocol) continue; // unsupported type (Telnet, Shell, …)

    const parts = m[2].split("%"); // [icon, host, port, user, …]
    const session = buildSession(key, protocol, parts, folder);
    if (session) out.push(session);
  }
  return out;
}

function buildSession(
  name: string,
  protocol: string,
  parts: string[],
  folder: string | null,
): Session | null {
  const at = (i: number) => (parts[i] ?? "").trim();
  let options: Opts;

  if (protocol === "serial") {
    const port = at(1);
    if (!port) return null;
    const baud = parseInt(at(2), 10) || 9600;
    options = {
      serialConfig: {
        port,
        baud_rate: baud,
        data_bits: 8,
        parity: "none",
        stop_bits: 1,
        flow_control: "none",
      },
    };
  } else {
    const host = at(1);
    if (!host) return null;
    const port = parseInt(at(2), 10) || DEFAULT_PORT[protocol] || 22;
    const username = at(3);

    if (protocol === "ssh" || protocol === "sftp") {
      options = {
        sshConfig: {
          host,
          port,
          auth: { method: "password", username, password: "" },
          host_key_policy: "accept_new",
        },
      };
    } else if (protocol === "rdp") {
      options = {
        rdpConfig: { host, port, username, password: "", domain: null, width: 1280, height: 800 },
      };
    } else if (protocol === "vnc") {
      options = { vncConfig: { host, port, password: "" } };
    } else {
      options = {
        ftpConfig: { host, port, username: username || "anonymous", password: "" },
      };
    }
  }

  return {
    id: crypto.randomUUID(),
    name: name || `${protocol} session`,
    protocol,
    folder_id: folder,
    tags: [],
    favorite: false,
    options,
    created_at: new Date().toISOString(),
    last_used_at: null,
  } as Session;
}

// ---- Export ----

// A complete, valid SSH bookmark tail (terminal/font/colour groups) appended
// after host/port/user so MobaXterm imports the line without complaint.
const SSH_TAIL =
  "%%-1%-1%%%%%0%0%0%%%-1%0%0%0%%1080%%0%0%1#MobaFont%10%0%0%-1%15%236,236,236%30,30,30%180,180,192%0%-1%0%%xterm%-1%-1%_Std_Colors_0_%80%24%0%1%-1%<none>%%0%-1%0%1%-1%0%0%0#0# #-1";

/** Serialize Session objects into MobaXterm `.mxtsessions` text. */
export function serializeMxtSessions(sessions: Session[]): string {
  const byFolder = new Map<string, Session[]>();
  for (const s of sessions) {
    const f = (s.folder_id ?? "").trim();
    if (!byFolder.has(f)) byFolder.set(f, []);
    byFolder.get(f)!.push(s);
  }

  const lines: string[] = [];
  const emit = (header: string, subRep: string, list: Session[]) => {
    lines.push(header);
    lines.push(`SubRep=${subRep}`);
    lines.push("ImgNum=42");
    for (const s of list) {
      const line = sessionToLine(s);
      if (line) lines.push(line);
    }
    lines.push("");
  };

  emit("[Bookmarks]", "", byFolder.get("") ?? []);
  let i = 1;
  for (const [folder, list] of byFolder) {
    if (folder === "") continue;
    emit(`[Bookmarks_${i}]`, folder.replace(/\//g, "\\"), list);
    i++;
  }
  return lines.join("\r\n");
}

function sessionToLine(s: Session): string | null {
  const o = s.options as Opts;
  const name = (s.name || "session").replace(/[=\r\n]/g, " ").trim();
  const type = PROTOCOL_TO_TYPE[s.protocol];
  if (type === undefined) return null;

  if (s.protocol === "ssh" || s.protocol === "sftp") {
    const c = o.sshConfig;
    if (!c) return null;
    const user = c.auth?.username ?? "";
    return `${name}= #0#0%${c.host}%${c.port}%${user}${SSH_TAIL}`;
  }
  if (s.protocol === "rdp" && o.rdpConfig) {
    const c = o.rdpConfig;
    return `${name}= #4#0%${c.host}%${c.port}%${c.username ?? ""}%`;
  }
  if (s.protocol === "vnc" && o.vncConfig) {
    const c = o.vncConfig;
    return `${name}= #5#0%${c.host}%${c.port}%`;
  }
  if (s.protocol === "ftp" && o.ftpConfig) {
    const c = o.ftpConfig;
    return `${name}= #6#0%${c.host}%${c.port}%${c.username ?? ""}%`;
  }
  if (s.protocol === "serial" && o.serialConfig) {
    const c = o.serialConfig;
    return `${name}= #8#0%${c.port}%${c.baud_rate}%`;
  }
  return null;
}
