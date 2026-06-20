import { useEffect, useRef, useState } from "react";
import { ipc } from "../lib/ipc";
import type { SshConfig } from "../lib/types";
import { SshConnectForm } from "./SshConnectForm";
import { TerminalView } from "./TerminalView";

const CONNECTING_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  gap: "var(--space-sm)",
  color: "var(--color-muted)",
  font: "var(--body-sm)",
};

export function SshSession({ initialConfig }: { initialConfig?: SshConfig }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const idRef = useRef<string | null>(null);
  const didAutoConnect = useRef(false);

  useEffect(() => {
    idRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    return () => {
      if (idRef.current) ipc.closeTerminal(idRef.current);
    };
  }, []);

  // Auto-connect when a saved session config is provided
  useEffect(() => {
    if (initialConfig && !didAutoConnect.current) {
      didAutoConnect.current = true;
      setConnecting(true);
      connect(initialConfig).catch((err) => {
        setConnectError(String(err));
        setConnecting(false);
      });
    }
  }, []); // intentionally empty — run only on mount

  const connect = async (config: SshConfig) => {
    setConnectError(null);
    setConnecting(true);
    const id = await ipc.openSsh(config, 24, 80);
    setSessionId(id);
    setConnecting(false);
  };

  if (connecting) {
    return (
      <div style={CONNECTING_STYLE}>
        Connecting…
      </div>
    );
  }

  if (!sessionId) {
    return (
      <SshConnectForm
        title={initialConfig ? "Reconnect" : "New SSH session"}
        cta="Connect"
        onConnect={connect}
        initialConfig={initialConfig}
        externalError={connectError}
      />
    );
  }

  return <TerminalView attachId={sessionId} />;
}
