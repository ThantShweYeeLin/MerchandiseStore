const { DefaultAzureCredential } = require("@azure/identity");
const { SecretClient } = require("@azure/keyvault-secrets");

// Single source of truth for the secrets this app needs.
const SECRETS = [
  { vaultName: "DATABASE-URL", envVar: "DATABASE_URL" },
  { vaultName: "JWT-SECRET", envVar: "JWT_SECRET" },
  { vaultName: "EDUCORE-API-KEY", envVar: "EDUCORE_API_KEY" },
  { vaultName: "EDUCORE-INBOUND-KEY", envVar: "EDUCORE_INBOUND_KEY" },
];

const REQUIRED_SECRETS = SECRETS.map((s) => s.vaultName);

let cachedSecrets = null;
let cachedClient = null;

/**
 * Loads secrets.
 *
 * Local development:
 *   ALLOW_LOCAL_DEV_SECRETS=true
 *   -> reads secrets from .env / process.env
 *
 * Production:
 *   -> reads secrets from Azure Key Vault
 */
async function loadSecrets() {
  if (cachedSecrets) return cachedSecrets;

  // ---------------------------------------------------------
  // LOCAL DEVELOPMENT
  // ---------------------------------------------------------
  // When ALLOW_LOCAL_DEV_SECRETS=true, use local environment
  // variables instead of Azure Key Vault.
  // ---------------------------------------------------------
  if (process.env.ALLOW_LOCAL_DEV_SECRETS === "true") {
    const fromEnv = {};
    const missing = [];

    for (const { vaultName: secretName, envVar } of SECRETS) {
      const value = process.env[envVar];

      if (!value) {
        missing.push(envVar);
      }

      fromEnv[secretName] = value;
    }

    if (missing.length) {
      throw new Error(
        `ALLOW_LOCAL_DEV_SECRETS is set, but these env vars are missing: ${missing.join(", ")}.`
      );
    }

    cachedSecrets = fromEnv;

    console.log("Using local environment secrets for development.");

    return cachedSecrets;
  }

  // ---------------------------------------------------------
  // PRODUCTION / AZURE KEY VAULT
  // ---------------------------------------------------------
  const vaultName = process.env.AZURE_KEY_VAULT_NAME;

  if (!vaultName) {
    throw new Error(
      "AZURE_KEY_VAULT_NAME is not set. Set it to use the real Key Vault, " +
        "or set ALLOW_LOCAL_DEV_SECRETS=true to explicitly opt into reading " +
        "secrets from plain env vars for local/team dev."
    );
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
    throw new Error(
      "Secrets have not been loaded yet. Call loadSecrets() at boot first."
    );
  }

  return cachedSecrets[name];
}

/**
 * Rotates a secret.
 *
 * Azure:
 *   Saves the new value to Key Vault.
 *
 * Local:
 *   Updates only the in-memory value.
 */
async function rotateSecret(name, newValue) {
  if (!cachedSecrets) {
    throw new Error(
      "Secrets have not been loaded yet. Call loadSecrets() at boot first."
    );
  }

  if (cachedClient) {
    await cachedClient.setSecret(name, newValue);
  }

  cachedSecrets[name] = newValue;

  return newValue;
}

module.exports = {
  loadSecrets,
  getSecret,
  rotateSecret,
};