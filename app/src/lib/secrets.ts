// Credential handling: keep secrets out of the SQLite store by stashing them in
// the OS keychain and resolving them again at connect time. Secrets live nested
// inside a session's `options` (per protocol), so each spec knows how to read
// and write its slot. Keyed in the keychain by session id + a stable field name.

import { ipc } from "./ipc";
import type { Session } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Opts = Record<string, any>;

interface SecretSpec {
  /** Keychain field name (account suffix). */
  field: string;
  get: (o: Opts) => string | undefined | null;
  set: (o: Opts, v: string) => void;
}

const SPECS: SecretSpec[] = [
  {
    field: "ssh.password",
    get: (o) => o.sshConfig?.auth?.password,
    set: (o, v) => {
      if (o.sshConfig?.auth) o.sshConfig.auth.password = v;
    },
  },
  {
    field: "ssh.passphrase",
    get: (o) => o.sshConfig?.auth?.passphrase,
    set: (o, v) => {
      if (o.sshConfig?.auth) o.sshConfig.auth.passphrase = v;
    },
  },
  {
    field: "ssh.private_key",
    get: (o) => o.sshConfig?.auth?.private_key,
    set: (o, v) => {
      if (o.sshConfig?.auth) o.sshConfig.auth.private_key = v;
    },
  },
  {
    field: "rdp.password",
    get: (o) => o.rdpConfig?.password,
    set: (o, v) => {
      if (o.rdpConfig) o.rdpConfig.password = v;
    },
  },
  {
    field: "vnc.password",
    get: (o) => o.vncConfig?.password,
    set: (o, v) => {
      if (o.vncConfig) o.vncConfig.password = v;
    },
  },
  {
    field: "ftp.password",
    get: (o) => o.ftpConfig?.password,
    set: (o, v) => {
      if (o.ftpConfig) o.ftpConfig.password = v;
    },
  },
];

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

/**
 * Move every present secret into the keychain, returning a sanitized copy of
 * the session that is safe to persist. If a keychain write fails (no backend,
 * value too large), the secret is left inline so connecting still works.
 */
export async function stashSecrets(session: Session): Promise<Session> {
  const out = clone(session);
  const opts = out.options as Opts;
  for (const spec of SPECS) {
    const val = spec.get(opts);
    if (!val) continue;
    try {
      await ipc.setSecret(session.id, spec.field, val);
      spec.set(opts, ""); // externalized — blank the persisted copy
    } catch {
      // Keychain unavailable — leave the secret inline as a fallback.
    }
  }
  return out;
}

/**
 * Fill any blank secret back in from the keychain, returning a connect-ready
 * copy. Slots that already hold a value (inline fallback) are left untouched.
 */
export async function injectSecrets(session: Session): Promise<Session> {
  const out = clone(session);
  const opts = out.options as Opts;
  for (const spec of SPECS) {
    if (spec.get(opts)) continue;
    try {
      const v = await ipc.getSecret(session.id, spec.field);
      if (v) spec.set(opts, v);
    } catch {
      // Ignore — fall through with the secret absent (prompt on connect).
    }
  }
  return out;
}

/** Remove all stored secrets for a session (called on delete). Best-effort. */
export async function clearSecrets(id: string): Promise<void> {
  await Promise.all(SPECS.map((s) => ipc.deleteSecret(id, s.field).catch(() => {})));
}
