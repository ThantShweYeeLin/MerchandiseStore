FROM node:20-slim

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

CMD ["node", "src/server.js"]
