FROM node:20-slim

# node:20-slim ships without OpenSSL, which Prisma's engine binaries need to
# detect the right build — without it, prisma generate/migrate silently
# defaults to the wrong engine and fails at runtime.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src

# AZURE_KEY_VAULT_NAME and AD_* / EDUCORE_BASE_URL are the only config passed
# via environment — everything secret comes from Key Vault at runtime.
ENV NODE_ENV=production
EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
