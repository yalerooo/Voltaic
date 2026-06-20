//! Connection and authentication configuration for the SSH client.

use serde::{Deserialize, Serialize};

/// How the client verifies the server's host key.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum HostKeyPolicy {
    /// Trust-on-first-use: accept any key, logging its fingerprint. Default for
    /// Phase 2; persistent `known_hosts` matching is a follow-up.
    #[default]
    AcceptNew,
    /// Reject connections whose key is not already trusted.
    Strict,
}

/// Authentication credentials. Secrets are passed in resolved form here (the
/// app resolves `secret_ref`/`key_ref` from the OS keychain before calling).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "method", rename_all = "snake_case")]
pub enum SshAuth {
    /// Username + password.
    Password { username: String, password: String },
    /// Private key in OpenSSH/PEM form, with an optional passphrase.
    Key {
        username: String,
        /// PEM/OpenSSH-encoded private key contents.
        private_key: String,
        #[serde(default)]
        passphrase: Option<String>,
    },
    /// Delegate to a running SSH agent.
    Agent { username: String },
}

impl SshAuth {
    /// The login username, regardless of method.
    pub fn username(&self) -> &str {
        match self {
            SshAuth::Password { username, .. }
            | SshAuth::Key { username, .. }
            | SshAuth::Agent { username } => username,
        }
    }
}

/// Everything needed to establish an SSH connection.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshConfig {
    pub host: String,
    #[serde(default = "default_port")]
    pub port: u16,
    pub auth: SshAuth,
    #[serde(default)]
    pub host_key_policy: HostKeyPolicy,
    /// Optional chain of jump hosts (bastions) to tunnel through, in order.
    #[serde(default)]
    pub jump_hosts: Vec<JumpHost>,
    /// Seconds before an idle connection is dropped; `None` disables.
    #[serde(default = "default_keepalive")]
    pub keepalive_secs: Option<u64>,
}

fn default_port() -> u16 {
    22
}

fn default_keepalive() -> Option<u64> {
    Some(30)
}

/// A bastion host in a jump chain.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JumpHost {
    pub host: String,
    #[serde(default = "default_port")]
    pub port: u16,
    pub auth: SshAuth,
}

impl SshConfig {
    /// Convenience constructor for a password connection.
    pub fn password(
        host: impl Into<String>,
        port: u16,
        username: impl Into<String>,
        password: impl Into<String>,
    ) -> Self {
        SshConfig {
            host: host.into(),
            port,
            auth: SshAuth::Password {
                username: username.into(),
                password: password.into(),
            },
            host_key_policy: HostKeyPolicy::default(),
            jump_hosts: Vec::new(),
            keepalive_secs: default_keepalive(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn auth_exposes_username() {
        let a = SshAuth::Agent {
            username: "root".into(),
        };
        assert_eq!(a.username(), "root");
    }

    #[test]
    fn config_deserializes_with_defaults() {
        let json = r#"{
            "host": "example.com",
            "auth": { "method": "password", "username": "u", "password": "p" }
        }"#;
        let cfg: SshConfig = serde_json::from_str(json).unwrap();
        assert_eq!(cfg.port, 22);
        assert_eq!(cfg.host_key_policy, HostKeyPolicy::AcceptNew);
        assert_eq!(cfg.keepalive_secs, Some(30));
    }
}
