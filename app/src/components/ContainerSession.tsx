// Shell-into-a-container/pod session. Opens an interactive exec PTY through the
// local docker/kubectl CLI on the backend, then renders the shared terminal
// view attached to it. Mirrors SshSession's lifecycle (open on mount, close on
// unmount); the backend stores the PTY in the same map as local shells, so the
// existing terminal input/resize/close commands all apply.

import { useEffect, useRef, useState } from "react";
import { ipc, isTauri } from "../lib/ipc";
import type { DockerConfig, KubernetesConfig } from "../lib/types";
import { TerminalView } from "./TerminalView";

const CENTER: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  padding: "var(--space-lg)",
  textAlign: "center",
  color: "var(--color-muted)",
  font: "var(--body-sm)",
};

export function ContainerSession({
  kind,
  dockerConfig,
  kubernetesConfig,
}: {
  kind: "docker" | "kubernetes";
  dockerConfig?: DockerConfig;
  kubernetesConfig?: KubernetesConfig;
}) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef<string | null>(null);

  useEffect(() => {
    idRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    if (!isTauri) return;
    let disposed = false;
    (async () => {
      try {
        const id =
          kind === "docker"
            ? await ipc.openDocker(dockerConfig!, 24, 80)
            : await ipc.openKubernetes(kubernetesConfig!, 24, 80);
        if (disposed) {
          ipc.closeTerminal(id);
          return;
        }
        setSessionId(id);
      } catch (e) {
        if (!disposed) setError(String(e));
      }
    })();
    return () => {
      disposed = true;
      if (idRef.current) ipc.closeTerminal(idRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div style={CENTER}>
        <div>
          <p style={{ color: "var(--color-error)" }}>Couldn't start the session.</p>
          <p style={{ marginTop: "var(--space-xs)" }}>{error}</p>
          <p style={{ marginTop: "var(--space-sm)", fontSize: 12 }}>
            Make sure the <code>{kind === "docker" ? "docker" : "kubectl"}</code> CLI is installed
            and on your PATH.
          </p>
        </div>
      </div>
    );
  }

  if (!sessionId) {
    return <div style={CENTER}>Starting session…</div>;
  }

  return <TerminalView attachId={sessionId} />;
}
