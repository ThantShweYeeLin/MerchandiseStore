const { DefaultAzureCredential } = require("@azure/identity");
const { SecretClient } = require("@azure/keyvault-secrets");

// Secret names expected in Azure Key Vault (set these up with the class Key Vault):
//   DATABASE-URL         -> Postgres connection string
//   JWT-SECRET            -> secret/key used to validate AD-issued tokens (or JWKS URI, see below)
//   AI-API-KEY             -> third-party AI text-generation API key
//   EDUCORE-API-KEY        -> key WE use to call EduCore (issued to us by them)
//   EDUCORE-INBOUND-KEY    -> key WE issue to EduCore so they can call us

const REQUIRED_SECRETS = [
  "DATABASE-URL",
  "JWT-SECRET",
  "AI-API-KEY",
  "EDUCORE-API-KEY",
  "EDUCORE-INBOUND-KEY",
];

let cachedSecrets = null;
// Only set when a real Key Vault is in use — lets rotateSecret() persist a
// new value there, instead of just updating the in-memory cache.
let cachedClient = null;

/**
 * Fetches all runtime secrets from Azure Key Vault once at boot and caches them
 * in memory. Never persisted to disk, never logged.
 */
// Maps each Key Vault secret name to the plain env var team members can set
// instead, for local/team dev where nobody has Azure Key Vault access yet.
const LOCAL_DEV_ENV_FALLBACK = {
  "DATABASE-URL": "DATABASE_URL",
  "JWT-SECRET": "JWT_SECRET",
  "AI-API-KEY": "AI_API_KEY",
  "EDUCORE-API-KEY": "EDUCORE_API_KEY",
  "EDUCORE-INBOUND-KEY": "EDUCORE_INBOUND_KEY",
};

async function loadSecrets() {
  if (cachedSecrets) return cachedSecrets;

  const vaultName = process.env.AZURE_KEY_VAULT_NAME;

  if (!vaultName) {
    // Local/team dev: no Key Vault access needed. Read the same secrets
    // straight from the environment (see docker-compose.yml / .env.example).
    // Production always sets AZURE_KEY_VAULT_NAME and skips this branch.
    const fromEnv = {};
    const missing = [];
    for (const [secretName, envVar] of Object.entries(LOCAL_DEV_ENV_FALLBACK)) {
      const value = process.env[envVar];
      if (!value) missing.push(envVar);
      fromEnv[secretName] = value;
    }
    if (missing.length) {
      throw new Error(
        "AZURE_KEY_VAULT_NAME is not set, and these local dev env vars are " +
          `also missing: ${missing.join(", ")}. Set AZURE_KEY_VAULT_NAME for ` +
          "the real Key Vault, or fill these in for local/team dev."
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
