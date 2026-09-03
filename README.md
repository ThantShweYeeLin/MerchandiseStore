# University E-Commerce & Merchandise Store — Backend

Headless (API-only) backend for official university merchandise. Staff manage
the catalog, students browse and order, and department discounts are
verified in real time against a peer service (EduCore) run by another team.

## Architecture Overview

```
Client (Web/Postman)
   │ HTTPS
   ▼
Nginx Reverse Proxy (TLS via Let's Encrypt) — class VPS
   ├── /content  → WordPress (existing, untouched)
   ├── /api      → Lab project (existing, untouched)
   └── /store    → Merch Store API (Node.js/Express, this repo)
                       ├── validates JWT access tokens → University AD (OIDC)
                       ├── fetches secrets at boot/runtime → Azure Key Vault
                       ├── CRUD Products & Orders (Prisma ORM) → PostgreSQL
                       ├── generates product descriptions → 3rd-party AI API
                       └── verifies department enrollment → EduCore (peer API)
```

- **Backend**: Node.js + Express, JSON-only REST API.
- **Database**: PostgreSQL via Prisma ORM (see `prisma/schema.prisma`).
- **Auth**: JWT bearer tokens issued by university AD (MSAL/OIDC), validated
  against the AD JWKS endpoint; RBAC enforced per-route (`STUDENT`, `STAFF`,
  `ADMIN`).
- **Secrets**: Azure Key Vault, fetched once at process boot. No `.env` files
  in production (`.env.example` is for local dev only).
- **Deployment**: Docker Compose behind Nginx, path-routed at `/store` so it
  coexists with the existing WordPress and Lab API on the same VPS.

## Setup

### Prerequisites
- Node.js 20+
- Docker & Docker Compose (for deployment)
- Access to the class Azure Key Vault, and an AD app registration for
  OIDC/MSAL login

### Local development (team — no Azure Key Vault access needed)
Every teammate can run this without any Azure/AD credentials. `.env` is
gitignored, so copy it fresh and keep your own values.
```bash
cp .env.example .env         # defaults work as-is; AZURE_KEY_VAULT_NAME stays blank
docker compose up -d db      # starts local Postgres only
npm install
npx prisma migrate dev
npm run dev                  # runs the API on the host, hot-reload via nodemon
```
With `AZURE_KEY_VAULT_NAME` left blank and `ALLOW_LOCAL_DEV_SECRETS=true` set
(both already in `.env.example`), `src/config/keyvault.js` reads
`DATABASE_URL`, `JWT_SECRET`, `AI_API_KEY`, `EDUCORE_API_KEY`, and
`EDUCORE_INBOUND_KEY` straight from `.env` instead of calling Key Vault. The
explicit `ALLOW_LOCAL_DEV_SECRETS` flag exists so a production host that
accidentally ends up with a blank `AZURE_KEY_VAULT_NAME` fails to boot
instead of silently falling back to leftover/weak env secrets — production's
env file should never set it.

To instead run the whole stack (API + Postgres) fully containerized:
```bash
docker compose up --build
```

### Local development against the real Key Vault (optional)
If you do have access to a dev Key Vault, set `AZURE_KEY_VAULT_NAME` (and the
`AZURE_CLIENT_ID`/`AZURE_TENANT_ID`/`AZURE_CLIENT_SECRET` app registration
values) in `.env` instead, and leave the plain secret vars blank — Key Vault
takes priority whenever `AZURE_KEY_VAULT_NAME` is set.

### Production deployment (VPS)
1. Add the Nginx location block in `nginx/merch-store.conf` to the existing
   server block for the class domain (do not modify the `/content` or `/api`
   blocks).
2. Set the non-secret environment variables (`AZURE_KEY_VAULT_NAME`,
   `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_CLIENT_SECRET`, `AD_JWKS_URI`,
   `AD_CLIENT_ID`, `AD_ISSUER`, `EDUCORE_BASE_URL`) wherever `docker-compose.yml`
   expects them (e.g. a shell profile or systemd env file — not committed).
3. `docker-compose.yml` also runs Postgres itself (the `db` service, backed
   by a named volume) so the store doesn't depend on a separately managed
   database. Set `DATABASE-URL` in Key Vault to
   `postgresql://<POSTGRES_USER>:<POSTGRES_PASSWORD>@db:5432/<POSTGRES_DB>`,
   using the same `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` values set
   in the VPS's env file (not committed).
4. Store `DATABASE-URL`, `JWT-SECRET`, `AI-API-KEY`, `EDUCORE-API-KEY`, and
   `EDUCORE-INBOUND-KEY` as secrets in the class Azure Key Vault (see
   `src/config/keyvault.js` for exact names expected).
5. Run:
   ```bash
   ./deploy.sh
   ```

## Peer API Documentation

This project partners with **[classmate/team name — fill in]**, who runs
**EduCore**, a department-enrollment verification service.

### What we consume from EduCore
- **Endpoint**: `GET {EDUCORE_BASE_URL}/enrollment/verify?studentId=&department=`
- **Auth**: static `x-api-key` header, issued to us by the EduCore team
  (stored as the `EDUCORE-API-KEY` secret in Key Vault).
- **When**: on every order placement, once per distinct department claimed
  by items in the order (`src/services/eduCoreClient.js`).
- **Data used**: a boolean enrollment result, logged in full in
  `PeerVerificationLog` for grading/audit purposes.
- **Failure handling**: if EduCore is unreachable or errors, we fail closed
  — no discount is applied, the order still completes at full price.

### What we expose for EduCore
- **Endpoint**: `GET /store/peer/students/:studentId/orders`
  (`src/routes/peer.js`)
- **Auth**: static `x-api-key` header we generate and issue exclusively to
  EduCore (stored as the `EDUCORE-INBOUND-KEY` secret in Key Vault; rotatable
  by `ADMIN`, rotations recorded in `AuditLog`).
- **Data returned**: order count, total spend, and discount usage broken
  down by department for the given student — no payment details.
- **Purpose**: lets EduCore fold our discount-usage data into their own
  department-enrollment reporting without direct database access.

### Everything above is an assumption until EduCore confirms otherwise
The request/response shape, the student identifier (`adObjectId` vs. a
university student ID number), and department naming (`"Computer Science"`
vs. a short code) are all this project's best guess, not a confirmed
contract — agree these with the EduCore team before treating them as fixed.

### Testing this integration before EduCore is reachable
`mock-educore/server.js` is a tiny local stand-in matching the *current*
assumed contract exactly (`GET /enrollment/verify?studentId=&department=`,
returns `{ verified: boolean }`). Update it alongside `eduCoreClient.js` if
the real contract ends up different.
```bash
node mock-educore/server.js          # listens on :4000
# then point the real app at it:
EDUCORE_BASE_URL=http://localhost:4000 npm run dev
```

## Other External Integration

**AI-generated product descriptions** — when STAFF/ADMIN create or update a
product, `src/services/aiDescription.js` calls Google's Gemini API with the
product name and category, and saves the returned SEO-friendly description
straight onto the `Product` record. `AI-API-KEY` is a Gemini API key from
[Google AI Studio](https://aistudio.google.com/apikey) (free tier).

## Project Structure
```
prisma/schema.prisma      Database schema (User, Product, Order, PeerVerificationLog, AuditLog, ...)
src/app.js                 Express app assembly, route mounting
src/server.js               Boot: load Key Vault secrets, then start listening
src/config/keyvault.js      Azure Key Vault secret loader
src/middleware/auth.js       JWT verification against AD JWKS + user upsert
src/middleware/rbac.js       Role-based route guards, peer API key guard
src/routes/                 categories, products, orders, peer (exposed to EduCore)
src/services/                aiDescription.js, eduCoreClient.js (external integrations)
src/utils/auditLog.js        Shared audit log writer
nginx/merch-store.conf       Nginx location block to add on the class VPS
docker-compose.yml / Dockerfile   Containerized deployment
deploy.sh                    One-command deploy script
```

## Team
| Name | ID |
|---|---|
| Aye Myat Myat Mon | 6611944 |
| Phyo Yadanar Min | 6611946 |
| Thant Shwe Yee Lin | 6632067 |
