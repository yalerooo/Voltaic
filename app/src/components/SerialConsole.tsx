// A serial console tab: a port picker form, then a TerminalView bound to the
// byte stream of the open port. Reuses the terminal-output channel so the
// rendering path is identical to local PTYs and SSH shells.

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ipc, isTauri } from "../lib/ipc";
import type { SerialConfig, SerialPortInfo } from "../lib/types";
import { TerminalView } from "./TerminalView";
import "./SerialConsole.css";

const BAUD_RATES = [
  9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600,
];

function defaultConfig(): SerialConfig {
  return {
    port: "",
    baud_rate: 115200,
    data_bits: 8,
    parity: "none",
    stop_bits: 1,
    flow_control: "none",
  };
}

export function SerialConsole({ initialConfig }: { initialConfig?: SerialConfig }) {
  const { t } = useTranslation();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ports, setPorts] = useState<SerialPortInfo[]>([]);
  const [cfg, setCfg] = useState<SerialConfig>(initialConfig ?? defaultConfig());
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const refreshPorts = async () => {
    if (!isTauri) return;
    try {
      const list = await ipc.listSerialPorts();
      setPorts(list);
      // Auto-select the first port if none chosen yet.
      setCfg((c) => (c.port || list.length === 0 ? c : { ...c, port: list[0].name }));
    } catch (e) {
      setError(String(e));
    }
  };

  useEffect(() => {
    refreshPorts();
  }, []);

  const connect = async (config: SerialConfig) => {
    setError(null);
    setConnecting(true);
    try {
      const id = await ipc.openSerial(config);
      setSessionId(id);
    } catch (e) {
      setError(String(e));
    } finally {
      setConnecting(false);
    }
  };

  // Auto-connect when a saved port config is provided.
  useEffect(() => {
    if (initialConfig?.port && !didAutoConnect.current) {
      didAutoConnect.current = true;
      connect(initialConfig);
    }
  }, []); // run once on mount

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cfg.port) {
      setError(t("serial.select_port_error"));
      return;
    }
    connect(cfg);
  };

  if (sessionId) {
    return <TerminalView attachId={sessionId} />;
  }

  if (connecting) {
    return <div className="serial__connecting">{t("serial.opening", { port: cfg.port })}</div>;
  }

  return (
    <div className="serial">
      <form className="serial__card" onSubmit={submit}>
        <h2 className="serial__title">{t("serial.new_serial_console")}</h2>

        <label className="serial__field">
          <span>{t("serial.port")}</span>
          <div className="serial__port-row">
            <select
              className="serial__input"
              value={cfg.port}
              onChange={(e) => setCfg({ ...cfg, port: e.target.value })}
            >
              <option value="" disabled>
                {ports.length ? t("serial.select_port") : t("serial.no_ports")}
              </option>
              {ports.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                  {p.product ? ` — ${p.product}` : ` (${p.kind})`}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="serial__refresh"
              onClick={refreshPorts}
              data-tooltip={t("serial.rescan")}
              data-tooltip-pos="bottom"
            >
              ↻
            </button>
          </div>
        </label>

        <div className="serial__row">
          <label className="serial__field">
            <span>{t("serial.baud_rate")}</span>
            <select
              className="serial__input"
              value={cfg.baud_rate}
              onChange={(e) => setCfg({ ...cfg, baud_rate: Number(e.target.value) })}
            >
              {BAUD_RATES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>

          <label className="serial__field">
            <span>{t("serial.data_bits")}</span>
            <select
              className="serial__input"
              value={cfg.data_bits}
              onChange={(e) => setCfg({ ...cfg, data_bits: Number(e.target.value) })}
            >
              {[5, 6, 7, 8].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="serial__row">
          <label className="serial__field">
            <span>{t("serial.parity")}</span>
            <select
              className="serial__input"
              value={cfg.parity}
              onChange={(e) =>
                setCfg({ ...cfg, parity: e.target.value as SerialConfig["parity"] })
              }
            >
              <option value="none">{t("serial.parity_none")}</option>
              <option value="odd">{t("serial.parity_odd")}</option>
              <option value="even">{t("serial.parity_even")}</option>
            </select>
          </label>

          <label className="serial__field">
            <span>{t("serial.stop_bits")}</span>
            <select
              className="serial__input"
              value={cfg.stop_bits}
              onChange={(e) => setCfg({ ...cfg, stop_bits: Number(e.target.value) })}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </label>

          <label className="serial__field">
            <span>{t("serial.flow_control")}</span>
            <select
              className="serial__input"
              value={cfg.flow_control}
              onChange={(e) =>
                setCfg({
                  ...cfg,
                  flow_control: e.target.value as SerialConfig["flow_control"],
                })
              }
            >
              <option value="none">{t("serial.flow_none")}</option>
              <option value="software">{t("serial.flow_software")}</option>
              <option value="hardware">{t("serial.flow_hardware")}</option>
            </select>
          </label>
        </div>

        {error && <p className="serial__error">{error}</p>}

        <button className="serial__submit" type="submit" disabled={!cfg.port}>
          {t("serial.open_port")}
        </button>
      </form>
    </div>
  );
}
