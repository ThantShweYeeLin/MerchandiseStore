#!/usr/bin/env bash
set -euo pipefail

# Automated deployment script for the University E-Commerce & Merchandise
# Store backend. Run this on the class VPS as the dedicated non-root deploy
# user, from inside the repo directory.

echo "==> Pulling latest code"
git pull origin main

echo "==> Building image"
docker compose build

echo "==> Running Prisma migrations (one-off container, prod DB via Key Vault)"
docker compose run --rm merch-store-api npx prisma migrate deploy

echo "==> Starting/updating service"
docker compose up -d

echo "==> Reloading Nginx (in case config changed)"
sudo nginx -t && sudo systemctl reload nginx

echo "==> Done. Health check:"
curl -fsS http://127.0.0.1:3000/health && echo
