const { createApp } = require("./app");
const { loadSecrets } = require("./config/keyvault");

const PORT = process.env.PORT || 3000;

async function main() {
  // Fetch DB connection string, JWT config, and API keys from Azure Key Vault
  // before anything else boots. No secrets ever come from a local .env in prod.
  await loadSecrets();

  // Prisma reads DATABASE_URL from process.env at import time, so mirror the
  // Key Vault value into the process env right before requiring the client.
  const { getSecret } = require("./config/keyvault");
  process.env.DATABASE_URL = getSecret("DATABASE-URL");

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Merch store API listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
