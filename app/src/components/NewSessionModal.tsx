import { useEffect, useRef, useState } from "react";
import { ipc, isTauri } from "../lib/ipc";
import { stashSecrets } from "../lib/secrets";
import type {
  DockerConfig,
  FtpConfig,
  KubernetesConfig,
  Protocol,
  RdpConfig,
  Session,
  SshConfig,
  VncConfig,
} from "../lib/types";
import { useAppStore } from "../store/appStore";
import "./NewSessionModal.css";

type AuthMethod = "password" | "key" | "agent";

interface ProtoMeta {
  id: Protocol | "local_shell";
  label: string;
  description: string;
  phase: number;
  /** Whether the interactive client is implemented yet. */
  implemented: boolean;
}

const PROTOCOLS: ProtoMeta[] = [
  { id: "local_shell", label: "Terminal", description: "Local shell session", phase: 1, implemented: true },
  { id: "ssh", label: "SSH", description: "Encrypted remote terminal", phase: 2, implemented: true },
  { id: "sftp", label: "SFTP", description: "SSH file transfer", phase: 2, implemented: true },
  { id: "ftp", label: "FTP", description: "Classic file transfer", phase: 3, implemented: true },
  { id: "serial", label: "Serial", description: "COM / serial port console", phase: 3, implemented: true },
  { id: "rdp", label: "RDP", description: "Remote Desktop Protocol", phase: 3, implemented: true },
  { id: "vnc", label: "VNC", description: "Virtual Network Computing", phase: 3, implemented: true },
  { id: "docker", label: "Docker", description: "Container shell", phase: 4, implemented: true },
  { id: "kubernetes", label: "Kubernetes", description: "K8s pod shell", phase: 4, implemented: true },
];

// Minimal inline SVG icons — one per protocol
function ProtoIcon({ id }: { id: string }) {
  const props = {
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    width: 28,
    height: 28,
  };
  switch (id) {
    case "local_shell":
      return (
        <svg {...props}>
          <rect x="2" y="4" width="16" height="12" rx="2" />
          <path d="M5 8l3 3-3 3M11 14h4" />
        </svg>
      );
    case "ssh":
      return (
        <svg {...props}>
          <rect x="4" y="9.5" width="12" height="8" rx="2" />
          <path d="M7 9.5V7a3 3 0 016 0v2.5" />
          <circle cx="10" cy="13.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "sftp":
      return (
        <svg {...props}>
          <path d="M3 5h5l2 2h7v9H3V5z" />
          <path d="M10 9v4M8 11.5l2 2 2-2" />
        </svg>
      );
    case "ftp":
      return (
        <svg {...props}>
          <path d="M3 5h5l2 2h7v9H3V5z" />
          <path d="M7 12h6M7 14.5h4" />
        </svg>
      );
    case "rdp":
      return (
        <svg {...props}>
          <rect x="2" y="4" width="16" height="10" rx="2" />
          <path d="M7 18h6M10 14v4" />
        </svg>
      );
    case "vnc":
      return (
        <svg {...props}>
          <path d="M2 10s3-5.5 8-5.5 8 5.5 8 5.5-3 5.5-8 5.5S2 10 2 10z" />
          <circle cx="10" cy="10" r="2.5" />
        </svg>
      );
    case "serial":
      return (
        <svg {...props}>
          <rect x="6" y="6" width="8" height="8" rx="1.5" />
          <path d="M9 6V4M11 6V4M9 14v2M11 14v2M6 9H4M6 11H4M14 9h2M14 11h2" />
        </svg>
      );
    case "docker":
      return (
        <svg {...props}>
          <path d="M10 3L17 7v6l-7 4-7-4V7l7-4z" />
          <path d="M10 7v4M7 8.5l3 1.5 3-1.5" />
        </svg>
      );
    case "kubernetes":
      return (
        <svg {...props}>
          <circle cx="10" cy="10" r="2.5" />
          <circle cx="10" cy="10" r="7.5" />
          <path d="M10 2.5v5M10 12.5v5M2.5 10h5M12.5 10h5M4.9 4.9l3.5 3.5M11.6 11.6l3.5 3.5M15.1 4.9l-3.5 3.5M8.4 11.6l-3.5 3.5" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="10" cy="10" r="7" />
          <path d="M10 6v4l2.5 2.5" />
        </svg>
      );
  }
}

type Step = "pick" | "configure";

export function NewSessionModal() {
  const closeModal = useAppStore((s) => s.closeNewSessionModal);
  const open = useAppStore((s) => s.newSessionModalOpen);
  const openTab = useAppStore((s) => s.openTab);
  const bumpSessionVersion = useAppStore((s) => s.bumpSessionVersion);

  const [step, setStep] = useState<Step>("pick");
  const [proto, setProto] = useState<ProtoMeta | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");
  const [username, setUsername] = useState("");
  const [authMethod, setAuthMethod] = useState<AuthMethod>("password");
  const [password, setPassword] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [domain, setDomain] = useState("");
  // Docker / Kubernetes fields
  const [container, setContainer] = useState("");
  const [dockerHost, setDockerHost] = useState("");
  const [pod, setPod] = useState("");
  const [namespace, setNamespace] = useState("");
  const [k8sContainer, setK8sContainer] = useState("");
  const [k8sContext, setK8sContext] = useState("");
  const [shellProg, setShellProg] = useState("sh");
  // Connect picker (browse containers/pods)
  const [browseList, setBrowseList] = useState<{ name: string; sub: string }[] | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const [browseError, setBrowseError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Focus name field when step changes to configure
  useEffect(() => {
    if (step === "configure") {
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [step]);

  if (!open) return null;

  const reset = () => {
    setStep("pick");
    setProto(null);
    setName("");
    setHost("");
    setPort("22");
    setUsername("");
    setAuthMethod("password");
    setPassword("");
    setPrivateKey("");
    setPassphrase("");
    setDomain("");
    setContainer("");
    setDockerHost("");
    setPod("");
    setNamespace("");
    setK8sContainer("");
    setK8sContext("");
    setShellProg("sh");
    setBrowseList(null);
    setBrowsing(false);
    setBrowseError("");
    setError("");
    setSaving(false);
  };

  const close = () => {
    reset();
    closeModal();
  };

  const pickProtocol = (p: ProtoMeta) => {
    if (p.id === "local_shell") {
      openTab({ title: "Terminal", kind: "terminal", shell: "default" });
      close();
      return;
    }
    setProto(p);
    setPort(p.id === "rdp" ? "3389" : p.id === "vnc" ? "5900" : "22");
    setStep("configure");
  };

  const buildSshConfig = (): SshConfig => {
    const auth: SshConfig["auth"] =
      authMethod === "password"
        ? { method: "password", username, password }
        : authMethod === "key"
          ? { method: "key", username, private_key: privateKey, passphrase: passphrase || null }
          : { method: "agent", username };
    return { host, port: parseInt(port) || 22, auth, host_key_policy: "accept_new" };
  };

  const buildRdpConfig = (): RdpConfig => ({
    host,
    port: parseInt(port) || 3389,
    username,
    password,
    domain: domain || null,
    width: 1280,
    height: 800,
  });

  const buildVncConfig = (): VncConfig => ({
    host,
    port: parseInt(port) || 5900,
    password,
  });

  const buildFtpConfig = (): FtpConfig => ({
    host,
    port: parseInt(port) || 21,
    username: username || "anonymous",
    password,
  });

  const buildDockerConfig = (): DockerConfig => ({
    container: container.trim(),
    shell: shellProg.trim() || "sh",
    host: dockerHost.trim() || null,
  });

  const buildK8sConfig = (): KubernetesConfig => ({
    pod: pod.trim(),
    namespace: namespace.trim() || null,
    container: k8sContainer.trim() || null,
    context: k8sContext.trim() || null,
    shell: shellProg.trim() || "sh",
  });

  const browseContainers = async () => {
    setBrowsing(true);
    setBrowseError("");
    setBrowseList(null);
    try {
      const items = await ipc.listDockerContainers(dockerHost.trim() || null);
      setBrowseList(
        items.map((c) => ({ name: c.name, sub: [c.image, c.status].filter(Boolean).join(" · ") })),
      );
    } catch (e) {
      setBrowseError(String(e));
    } finally {
      setBrowsing(false);
    }
  };

  const browsePods = async () => {
    setBrowsing(true);
    setBrowseError("");
    setBrowseList(null);
    try {
      const items = await ipc.listKubernetesPods(k8sContext.trim() || null, namespace.trim() || null);
      setBrowseList(items.map((p) => ({ name: p.name, sub: p.status })));
    } catch (e) {
      setBrowseError(String(e));
    } finally {
      setBrowsing(false);
    }
  };

  const renderBrowse = (onPick: (name: string) => void) => (
    <>
      {browseError && <p className="nsm-error">{browseError}</p>}
      {browseList &&
        (browseList.length === 0 ? (
          <p className="nsm-note">Nothing running found.</p>
        ) : (
          <div className="nsm-picker">
            {browseList.map((it) => (
              <button
                type="button"
                key={it.name}
                className="nsm-picker-item"
                onClick={() => onPick(it.name)}
              >
                <span className="nsm-picker-name">{it.name}</span>
                {it.sub && <span className="nsm-picker-sub">{it.sub}</span>}
              </button>
            ))}
          </div>
        ))}
    </>
  );

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Session name is required.");
      return;
    }
    const isSsh = proto?.id === "ssh" || proto?.id === "sftp";
    const isRdp = proto?.id === "rdp";
    const isVnc = proto?.id === "vnc";
    const isFtp = proto?.id === "ftp";
    const isDocker = proto?.id === "docker";
    const isK8s = proto?.id === "kubernetes";
    const needsHost = isSsh || isRdp || isVnc || isFtp;
    if (needsHost && !host.trim()) {
      setError("Host is required.");
      return;
    }
    if (isDocker && !container.trim()) {
      setError("Container name or id is required.");
      return;
    }
    if (isK8s && !pod.trim()) {
      setError("Pod name is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const sshCfg = isSsh ? buildSshConfig() : undefined;
      const rdpCfg = isRdp ? buildRdpConfig() : undefined;
      const vncCfg = isVnc ? buildVncConfig() : undefined;
      const ftpCfg = isFtp ? buildFtpConfig() : undefined;
      const dockerCfg = isDocker ? buildDockerConfig() : undefined;
      const k8sCfg = isK8s ? buildK8sConfig() : undefined;
      const options = sshCfg
        ? { sshConfig: sshCfg }
        : rdpCfg
          ? { rdpConfig: rdpCfg }
          : vncCfg
            ? { vncConfig: vncCfg }
            : ftpCfg
              ? { ftpConfig: ftpCfg }
              : dockerCfg
                ? { dockerConfig: dockerCfg }
                : k8sCfg
                  ? { kubernetesConfig: k8sCfg }
                  : {};

      const session: Session = {
        id: crypto.randomUUID(),
        name: name.trim(),
        protocol: proto!.id as Protocol,
        folder_id: null,
        tags: [],
        favorite: false,
        options,
        created_at: new Date().toISOString(),
        last_used_at: null,
      };

      if (isTauri) {
        // Externalize credentials to the OS keychain when enabled (default),
        // persisting only a secret-free copy. The live tab below still uses the
        // in-memory configs, so the immediate connection keeps its credentials.
        let toPersist = session;
        try {
          const cfg = await ipc.getConfig();
          if (cfg.security.use_os_keychain) {
            toPersist = await stashSecrets(session);
          }
        } catch {
          // Config unreadable — fall back to persisting as-is.
        }
        await ipc.saveSession(toPersist);
      }

      bumpSessionVersion();

      // Open the live tab for implemented protocols.
      if (proto!.implemented) {
        openTab({
          title: name.trim(),
          kind: "session",
          protocol: proto!.id as Protocol,
          sshConfig: sshCfg,
          rdpConfig: rdpCfg,
          vncConfig: vncCfg,
          ftpConfig: ftpCfg,
          dockerConfig: dockerCfg,
          kubernetesConfig: k8sCfg,
        });
      }

      close();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  const isSoon = proto ? !proto.implemented : false;
  const isSsh = proto?.id === "ssh" || proto?.id === "sftp";
  const isRdp = proto?.id === "rdp";
  const isVnc = proto?.id === "vnc";
  const isFtp = proto?.id === "ftp";
  const isDocker = proto?.id === "docker";
  const isK8s = proto?.id === "kubernetes";
  const needsHost = isSsh || isRdp || isVnc || isFtp;
  const needsPassword = isRdp || isVnc || isFtp;

  return (
    <div className="nsm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="nsm-card" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="nsm-header">
          <span className="nsm-title">
            {step === "pick" ? "New Session" : proto?.label ?? ""}
          </span>
          <button className="nsm-close" onClick={close} aria-label="Close">✕</button>
        </div>

        {/* Step 1: protocol picker */}
        {step === "pick" && (
          <div className="nsm-grid">
            {PROTOCOLS.map((p) => (
              <button
                key={p.id}
                className={`nsm-proto nsm-proto--${p.id}${p.implemented ? "" : " nsm-proto--soon"}`}
                onClick={() => pickProtocol(p)}
              >
                <span className="nsm-proto-icon">
                  <ProtoIcon id={p.id} />
                </span>
                <span className="nsm-proto-label">{p.label}</span>
                <span className="nsm-proto-desc">{p.description}</span>
                {!p.implemented && (
                  <span className="nsm-proto-badge">Phase {p.phase}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Step 2: configure */}
        {step === "configure" && proto && (
          <div className="nsm-form">
            <button className="nsm-back" onClick={() => { setStep("pick"); setError(""); }}>
              ← Back
            </button>

            {isSoon ? (
              <div className="nsm-soon-msg">
                <ProtoIcon id={proto.id} />
                <p>
                  <strong>{proto.label}</strong> is coming in Phase {proto.phase}.
                  <br />
                  You can save this session now — it will be available once the protocol is implemented.
                </p>
              </div>
            ) : null}

            <div className="nsm-field">
              <label htmlFor="nsm-name">Session name</label>
              <input
                id="nsm-name"
                ref={nameRef}
                className="nsm-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`My ${proto.label} session`}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
            </div>

            {needsHost && (
              <>
                <div className="nsm-row">
                  <div className="nsm-field">
                    <label htmlFor="nsm-host">Host</label>
                    <input
                      id="nsm-host"
                      className="nsm-input"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      placeholder="example.com"
                    />
                  </div>
                  <div className="nsm-field">
                    <label htmlFor="nsm-port">Port</label>
                    <input
                      id="nsm-port"
                      className="nsm-input"
                      type="number"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      min={1}
                      max={65535}
                    />
                  </div>
                </div>

                {!isVnc && (
                  <div className="nsm-field">
                    <label htmlFor="nsm-user">Username</label>
                    <input
                      id="nsm-user"
                      className="nsm-input"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={isFtp ? "anonymous" : "root"}
                    />
                  </div>
                )}

                {isSsh && (
                  <>
                <div className="nsm-auth-tabs">
                  {(["password", "key", "agent"] as AuthMethod[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`nsm-auth-tab${authMethod === m ? " is-active" : ""}`}
                      onClick={() => setAuthMethod(m)}
                    >
                      {m === "password" ? "Password" : m === "key" ? "Private key" : "Agent"}
                    </button>
                  ))}
                </div>

                {authMethod === "password" && (
                  <div className="nsm-field">
                    <label htmlFor="nsm-pass">Password</label>
                    <input
                      id="nsm-pass"
                      className="nsm-input"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Leave empty to enter on connect"
                    />
                  </div>
                )}

                {authMethod === "key" && (
                  <>
                    <div className="nsm-field">
                      <label htmlFor="nsm-key">Private key (PEM / OpenSSH)</label>
                      <textarea
                        id="nsm-key"
                        className="nsm-input nsm-textarea"
                        value={privateKey}
                        onChange={(e) => setPrivateKey(e.target.value)}
                        placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                        rows={4}
                      />
                    </div>
                    <div className="nsm-field">
                      <label htmlFor="nsm-phrase">Passphrase (optional)</label>
                      <input
                        id="nsm-phrase"
                        className="nsm-input"
                        type="password"
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {authMethod === "agent" && (
                  <p className="nsm-note">
                    Uses identities from your running SSH agent — <code>ssh-agent</code>{" "}
                    via <code>$SSH_AUTH_SOCK</code> on macOS/Linux, or the OpenSSH
                    agent named pipe on Windows.
                  </p>
                )}
                  </>
                )}

                {needsPassword && (
                  <>
                    <div className="nsm-field">
                      <label htmlFor="nsm-rdp-pass">Password</label>
                      <input
                        id="nsm-rdp-pass"
                        className="nsm-input"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Leave empty to enter on connect"
                      />
                    </div>
                    {isRdp && (
                      <div className="nsm-field">
                        <label htmlFor="nsm-domain">Domain (optional)</label>
                        <input
                          id="nsm-domain"
                          className="nsm-input"
                          value={domain}
                          onChange={(e) => setDomain(e.target.value)}
                          placeholder="WORKGROUP"
                        />
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {isDocker && (
              <>
                <div className="nsm-field">
                  <div className="nsm-field-head">
                    <label htmlFor="nsm-container">Container (name or id)</label>
                    <button
                      type="button"
                      className="nsm-browse"
                      onClick={browseContainers}
                      disabled={browsing}
                    >
                      {browsing ? "Loading…" : "Browse running"}
                    </button>
                  </div>
                  <input
                    id="nsm-container"
                    className="nsm-input"
                    value={container}
                    onChange={(e) => setContainer(e.target.value)}
                    placeholder="my-container"
                    onKeyDown={(e) => e.key === "Enter" && handleSave()}
                  />
                  {renderBrowse(setContainer)}
                </div>
                <div className="nsm-row">
                  <div className="nsm-field">
                    <label htmlFor="nsm-shell">Shell</label>
                    <input
                      id="nsm-shell"
                      className="nsm-input"
                      value={shellProg}
                      onChange={(e) => setShellProg(e.target.value)}
                      placeholder="sh"
                    />
                  </div>
                  <div className="nsm-field">
                    <label htmlFor="nsm-dhost">Docker host (optional)</label>
                    <input
                      id="nsm-dhost"
                      className="nsm-input"
                      value={dockerHost}
                      onChange={(e) => setDockerHost(e.target.value)}
                      placeholder="ssh://user@host"
                    />
                  </div>
                </div>
                <p className="nsm-note">
                  Runs <code>docker exec -it</code> via the local Docker CLI.
                </p>
              </>
            )}

            {isK8s && (
              <>
                <div className="nsm-row">
                  <div className="nsm-field">
                    <div className="nsm-field-head">
                      <label htmlFor="nsm-pod">Pod</label>
                      <button
                        type="button"
                        className="nsm-browse"
                        onClick={browsePods}
                        disabled={browsing}
                      >
                        {browsing ? "Loading…" : "Browse pods"}
                      </button>
                    </div>
                    <input
                      id="nsm-pod"
                      className="nsm-input"
                      value={pod}
                      onChange={(e) => setPod(e.target.value)}
                      placeholder="my-pod"
                      onKeyDown={(e) => e.key === "Enter" && handleSave()}
                    />
                  </div>
                  <div className="nsm-field">
                    <label htmlFor="nsm-ns">Namespace (optional)</label>
                    <input
                      id="nsm-ns"
                      className="nsm-input"
                      value={namespace}
                      onChange={(e) => setNamespace(e.target.value)}
                      placeholder="default"
                    />
                  </div>
                </div>
                {renderBrowse(setPod)}
                <div className="nsm-row">
                  <div className="nsm-field">
                    <label htmlFor="nsm-kcontainer">Container (optional)</label>
                    <input
                      id="nsm-kcontainer"
                      className="nsm-input"
                      value={k8sContainer}
                      onChange={(e) => setK8sContainer(e.target.value)}
                      placeholder="main"
                    />
                  </div>
                  <div className="nsm-field">
                    <label htmlFor="nsm-kctx">Context (optional)</label>
                    <input
                      id="nsm-kctx"
                      className="nsm-input"
                      value={k8sContext}
                      onChange={(e) => setK8sContext(e.target.value)}
                      placeholder="current"
                    />
                  </div>
                </div>
                <div className="nsm-field">
                  <label htmlFor="nsm-kshell">Shell</label>
                  <input
                    id="nsm-kshell"
                    className="nsm-input"
                    value={shellProg}
                    onChange={(e) => setShellProg(e.target.value)}
                    placeholder="sh"
                  />
                </div>
                <p className="nsm-note">
                  Runs <code>kubectl exec -it</code> via the local kubectl CLI.
                </p>
              </>
            )}

            {error && <p className="nsm-error">{error}</p>}

            <div className="nsm-footer">
              <button className="nsm-btn-cancel" onClick={close}>
                Cancel
              </button>
              <button
                className="nsm-btn-save"
                onClick={handleSave}
                disabled={saving}
              >
                {saving
                  ? "Saving…"
                  : needsHost || isDocker || isK8s
                    ? "Save & Connect"
                    : "Save Session"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
