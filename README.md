# University E-Commerce & Merchandise Store — Backend

Headless (API-only) backend for official university merchandise. Staff manage
the catalog, students browse and order, and department discounts are
verified in real time against an external service before being applied —
originally designed against a classmate's peer service (EduCore); per
updated course requirements this is demonstrated against a public API
instead (see [Peer API Documentation](#peer-api-documentation)).

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

### Full end-to-end testing without real AD or EduCore access
`POST /products` and `POST /orders` require a real AD-issued JWT, and order
placement calls EduCore — neither is available outside the university's
actual AD/EduCore. `mock-ad/server.js` and `mock-educore/server.js` stand in
for both, so the entire flow (staff login → create product → student login →
place order → discount) can be run live via curl/Postman, not just jest:
```bash
node mock-ad/server.js       # :4001 — fake AD/JWKS + token minting
node mock-educore/server.js  # :4000 — fake EduCore enrollment check
AD_JWKS_URI=http://localhost:4001/discovery/v2.0/keys \
AD_ISSUER=http://localhost:4001 \
AD_CLIENT_ID=mock-client-id \
EDUCORE_BASE_URL=http://localhost:4000 \
npm run dev

# mint a token for any role:
curl -X POST http://localhost:4001/mock-login -H "Content-Type: application/json" \
  -d '{"role":"STAFF","adObjectId":"ad-staff-1","email":"staff@example.edu"}'
# -> { "token": "..." }, use as: -H "Authorization: Bearer <token>"
```
Both mocks are dev-only tooling, never used in production (real AD/EduCore
are always used there instead).

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

**Per updated course requirements, connecting to a classmate's real peer API
is no longer required — a public API demonstrating the same integration
pattern (real outbound HTTP call, real response, used to drive a real
business decision) is sufficient.** The project's own architecture is
otherwise unchanged: the enrollment-check integration is isolated behind
`src/services/eduCoreClient.js`, so pointing it at a real EduCore later
(if one ever exists) is a one-file change — see
[`docs/educore-contract.md`](docs/educore-contract.md) for the full
draft contract this was designed against.

### What we consume: a public API, standing in for a peer department-enrollment service
- **Endpoint called**: `GET {EDUCORE_BASE_URL}/enrollment/verify?studentId=&department=`
  — our own `mock-educore/server.js`, run in `MOCK_EDUCORE_MODE=public-api`.
- **What that server actually does**: makes a real call to **JSONPlaceholder**
  (`GET https://jsonplaceholder.typicode.com/todos/{id}`), a public REST test
  API, and logs the response — demonstrating a genuine external network call,
  per the course's updated requirement that a public API is sufficient here.
  The actual verified/not-verified decision does **not** come from that
  response, though: the public API has no real knowledge of university
  enrollment, so doing that would make verification a coin flip per
  `(student, department)` pair — which was a real bug caught during testing,
  where a Computer Science student could randomly "pass" for Business or
  Engineering too. The decision instead comes from a small roster in
  `mock-educore/server.js` mapping each demo student to their one real
  department, so a student is only ever discounted on their own department,
  no matter how many other departments' items are in the same order.
- **Auth**: static `x-api-key` header (stored as the `EDUCORE-API-KEY`
  secret in Key Vault) — kept even though the current backing service is
  public, since the real requirement (a server-held key, one-way outbound
  call) is what's being demonstrated.
- **When**: on every order placement, once per distinct department claimed
  by items in the order (`src/services/eduCoreClient.js`).
- **Data used**: a boolean enrollment result, logged in full in
  `PeerVerificationLog` for grading/audit purposes.
- **Failure handling**: if the call is unreachable or errors, we fail
  closed — no discount is applied, the order still completes at full price.
- **Demo roster** (`mock-educore/server.js`'s `ROSTER`) — any studentId not
  listed has no known enrollment anywhere, so it's always denied (no random
  luck for arbitrary test logins):

  | studentId | real department | Result |
  |---|---|---|
  | `ad-student-3` | Business | verified only when ordering a **Business** item |
  | `ad-student-1` | Computer Science | verified only when ordering a **Computer Science** item |

  Try `ad-student-1` ordering a Computer Science item *and* a Business item
  in the same order — only the CS item gets discounted, proving the check
  is per-department and per-student, not blanket.

  ```bash
  MOCK_EDUCORE_MODE=public-api node mock-educore/server.js   # :4000
  EDUCORE_BASE_URL=http://localhost:4000 npm run dev
  ```

### What we expose, for a peer service to consume from us
- **Endpoint**: `GET /store/peer/students/:studentId/orders`
  (`src/routes/peer.js`)
- **Auth**: static `x-api-key` header we generate and issue to whoever
  consumes it (stored as the `EDUCORE-INBOUND-KEY` secret in Key Vault;
  rotatable by `ADMIN`, rotations recorded in `AuditLog`).
- **Data returned**: order count, total spend, and discount usage broken
  down by department for the given student — no payment details.
- **Purpose**: demonstrates the "expose" half of a peer integration —
  a partner service could fold this store's discount-usage data into their
  own reporting without direct database access.

### If a real classmate's EduCore ever becomes available
Swap `EDUCORE_BASE_URL` to point at it and confirm the contract in
`docs/educore-contract.md` matches theirs (student identifier, department
naming, and request shape are documented there as open questions) —
`eduCoreClient.js` is the only file that would need to change.

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
