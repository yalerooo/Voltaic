import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { SshConfig } from "../lib/types";
import "./SshConnectForm.css";

type AuthMethod = "password" | "key" | "agent";

function initFromConfig(cfg?: SshConfig) {
  const auth = cfg?.auth;
  return {
    host: cfg?.host ?? "",
    port: cfg?.port ?? 22,
    username: auth?.username ?? "",
    method: (auth?.method ?? "password") as AuthMethod,
    password: auth?.method === "password" ? auth.password : "",
    privateKey: auth?.method === "key" ? auth.private_key : "",
    passphrase: auth?.method === "key" ? (auth.passphrase ?? "") : "",
  };
}

export function SshConnectForm({
  title,
  cta,
  onConnect,
  initialConfig,
  externalError,
}: {
  title: string;
  cta: string;
  onConnect: (config: SshConfig) => Promise<void>;
  initialConfig?: SshConfig;
  externalError?: string | null;
}) {
  const { t } = useTranslation();
  const init = initFromConfig(initialConfig);
  const [host, setHost] = useState(init.host);
  const [port, setPort] = useState(init.port);
  const [username, setUsername] = useState(init.username);
  const [method, setMethod] = useState<AuthMethod>(init.method);
  const [password, setPassword] = useState(init.password);
  const [privateKey, setPrivateKey] = useState(init.privateKey);
  const [passphrase, setPassphrase] = useState(init.passphrase);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayError = error ?? externalError ?? null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const auth: SshConfig["auth"] =
        method === "password"
          ? { method, username, password }
          : method === "key"
            ? { method, username, private_key: privateKey, passphrase }
            : { method, username };
      await onConnect({ host, port, auth, host_key_policy: "accept_new" });
    } catch (err) {
      setError(String(err));
      setBusy(false);
    }
  };

  return (
    <div className="connect">
      <form className="connect__card" onSubmit={submit}>
        <h2 className="connect__title">{title}</h2>

        <div className="connect__row">
          <label className="connect__field connect__field--grow">
            <span>{t("form.host")}</span>
            <input
              className="connect__input"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder={t("form.ph_host")}
              required
              autoFocus={!initialConfig}
            />
          </label>
          <label className="connect__field connect__field--port">
            <span>{t("form.port")}</span>
            <input
              className="connect__input"
              type="number"
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
              min={1}
              max={65535}
            />
          </label>
        </div>

        <label className="connect__field">
          <span>{t("form.username")}</span>
          <input
            className="connect__input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t("form.ph_root")}
            required
          />
        </label>

        <div className="connect__tabs">
          {(["password", "key", "agent"] as AuthMethod[]).map((m) => (
            <button
              type="button"
              key={m}
              className={"connect__tab" + (method === m ? " is-active" : "")}
              onClick={() => setMethod(m)}
            >
              {m === "password" ? t("form.auth_password") : m === "key" ? t("form.auth_key") : t("form.auth_agent")}
            </button>
          ))}
        </div>

        {method === "password" && (
          <label className="connect__field">
            <span>{t("form.password")}</span>
            <input
              className="connect__input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}

        {method === "key" && (
          <>
            <label className="connect__field">
              <span>{t("form.private_key")}</span>
              <textarea
                className="connect__input connect__textarea"
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder={t("form.ph_private_key")}
                rows={4}
              />
            </label>
            <label className="connect__field">
              <span>{t("form.passphrase_optional")}</span>
              <input
                className="connect__input"
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
              />
            </label>
          </>
        )}

        {method === "agent" && (
          <p className="connect__note">
            {t("form.agent_note")}
          </p>
        )}

        {displayError && <p className="connect__error">{displayError}</p>}

        <button className="connect__submit" type="submit" disabled={busy}>
          {busy ? t("form.connecting") : cta}
        </button>
      </form>
    </div>
  );
}
