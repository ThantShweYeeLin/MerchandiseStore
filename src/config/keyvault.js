const { DefaultAzureCredential } = require("@azure/identity");
const { SecretClient } = require("@azure/keyvault-secrets");

// Single source of truth for the secrets this app needs: the Key Vault
// secret name, and the plain env var team members can set instead for
// local/team dev (see docker-compose.yml / .env.example).
const SECRETS = [
  { vaultName: "DATABASE-URL", envVar: "DATABASE_URL" },
  { vaultName: "JWT-SECRET", envVar: "JWT_SECRET" },
  { vaultName: "AI-API-KEY", envVar: "AI_API_KEY" },
  { vaultName: "EDUCORE-API-KEY", envVar: "EDUCORE_API_KEY" },
  { vaultName: "EDUCORE-INBOUND-KEY", envVar: "EDUCORE_INBOUND_KEY" },
];
const REQUIRED_SECRETS = SECRETS.map((s) => s.vaultName);

let cachedSecrets = null;
// Only set when a real Key Vault is in use — lets rotateSecret() persist a
// new value there, instead of just updating the in-memory cache.
let cachedClient = null;

/**
 * Fetches all runtime secrets from Azure Key Vault once at boot and caches them
 * in memory. Never persisted to disk, never logged.
 */
async function loadSecrets() {
  if (cachedSecrets) return cachedSecrets;

  const vaultName = process.env.AZURE_KEY_VAULT_NAME;

  if (!vaultName) {
    // Local/team dev only: requires an explicit opt-in (not just a missing
    // AZURE_KEY_VAULT_NAME) so a misconfigured production host — e.g. a
    // blank env var from a bad deploy — fails loudly instead of silently
    // booting on leftover/weak local secrets.
    if (process.env.ALLOW_LOCAL_DEV_SECRETS !== "true") {
      throw new Error(
        "AZURE_KEY_VAULT_NAME is not set. Set it to use the real Key Vault, " +
          "or set ALLOW_LOCAL_DEV_SECRETS=true to explicitly opt into reading " +
          "secrets from plain env vars for local/team dev."
      );
    }

    const fromEnv = {};
    const missing = [];
    for (const { vaultName: secretName, envVar } of SECRETS) {
      const value = process.env[envVar];
      if (!value) missing.push(envVar);
      fromEnv[secretName] = value;
    }
    if (missing.length) {
      throw new Error(
        `ALLOW_LOCAL_DEV_SECRETS is set, but these env vars are missing: ${missing.join(", ")}.`
      );
    }

    cachedSecrets = fromEnv;
    return cachedSecrets;
  }

  const vaultUrl = `https://${vaultName}.vault.azure.net`;
  const credential = new DefaultAzureCredential();
  const client = new SecretClient(vaultUrl, credential);
  cachedClient = client;

  const entries = await Promise.all(
    REQUIRED_SECRETS.map(async (name) => {
      const secret = await client.getSecret(name);
      return [name, secret.value];
    })
  );

  cachedSecrets = Object.fromEntries(entries);
  return cachedSecrets;
}

function getSecret(name) {
  if (!cachedSecrets) {
    throw new Error("Secrets have not been loaded yet. Call loadSecrets() at boot first.");
  }
  return cachedSecrets[name];
}

/**
 * Rotates a secret (e.g. EDUCORE-INBOUND-KEY) to `newValue`. Persists to Key
 * Vault when one is configured; in local/team dev (no vault) this only
 * updates the in-memory cache, so a restart reverts to the .env value.
 *
 * Known limitation: with more than one API instance running (horizontal
 * scaling), this only updates the instance that handled the rotation
 * request — the others keep validating against the old key until they
 * restart and reload secrets from Key Vault. Fine for this project's
 * single-instance deployment; a multi-instance setup would need each
 * instance to re-fetch on a schedule or via a pub/sub invalidation signal.
 */
async function rotateSecret(name, newValue) {
  if (!cachedSecrets) {
    throw new Error("Secrets have not been loaded yet. Call loadSecrets() at boot first.");
  }
  if (cachedClient) {
    await cachedClient.setSecret(name, newValue);
  }
  cachedSecrets[name] = newValue;
  return newValue;
}

module.exports = { loadSecrets, getSecret, rotateSecret };
