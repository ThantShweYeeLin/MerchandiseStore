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

/**
 * Fetches all runtime secrets from Azure Key Vault once at boot and caches them
 * in memory. Never persisted to disk, never logged.
 */
async function loadSecrets() {
  if (cachedSecrets) return cachedSecrets;

  const vaultName = process.env.AZURE_KEY_VAULT_NAME;
  if (!vaultName) {
    throw new Error(
      "AZURE_KEY_VAULT_NAME is not set. This is the only config allowed to come " +
        "from the environment — everything else must be fetched from Key Vault."
    );
  }

  const vaultUrl = `https://${vaultName}.vault.azure.net`;
  const credential = new DefaultAzureCredential();
  const client = new SecretClient(vaultUrl, credential);

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

module.exports = { loadSecrets, getSecret };
