# Testing Evidence

Two layers of testing exist for this project: an automated Jest suite (unit
level, Prisma/EduCore mocked), and live end-to-end verification against real
Postgres over real HTTP (auth and EduCore mocked via `mock-ad/` and
`mock-educore/`, matching their real contracts). Both are recorded here.

## Automated test suite

```
npx jest
```
39 tests across 5 suites, all passing as of the latest commit:

| Suite | Covers |
|---|---|
| `tests/products.test.js` | Product CRUD, AI description generation + failure fallback, image add/remove, RBAC |
| `tests/categories.test.js` | Category CRUD, RBAC (ADMIN-only for PUT/DELETE) |
| `tests/orders.test.js` | Order placement, per-department discount correctness (including the mixed-department case), STAFF/ADMIN order visibility, RBAC |
| `tests/peer.test.js` | EduCore-facing summary endpoint, auth, per-department discount usage accuracy |
| `tests/admin.test.js` | Audit log access, role override, EduCore key rotation, RBAC |

## Live end-to-end verification (real HTTP, real Postgres)

Run using `mock-ad/server.js` (fake AD/JWKS, mints real RS256 JWTs) and
`mock-educore/server.js` (fake EduCore, matches the real client's contract),
against a real Postgres container — no jest, no mocked Prisma.

| Step | Action | Result |
|---|---|---|
| 1 | Staff login via mock AD | Valid JWT issued and accepted by `requireAuth` |
| 2 | `POST /categories` as STAFF | 201, category created |
| 3 | `POST /products` as STAFF | 201, product created; AI call made with placeholder key → `description: null`, product still created (graceful fallback proven) |
| 4 | Student login via mock AD (department: Computer Science) | Valid JWT issued |
| 5 | `POST /orders` — 1 item, category "Computer Science" | 201; mock EduCore verified enrollment; `totalAmount: 34` (15% off $40); `discountApplied: true`; `PeerVerificationLog` created with `verified: true` |
| 6 | Admin login, `GET /admin/audit-log` | Returns `["ORDER_PLACED", "PRODUCT_CREATE", "CATEGORY_CREATE"]` — full trail present |
| 7 | `GET /peer/students/ad-student-1/orders` with correct `x-api-key` | 200, `{orderCount: 1, totalSpend: 34, discountUsageByDepartment: {"Computer Science": 1}}` |
| 8 | Same endpoint, wrong `x-api-key` | 401 |
| 9 | Same endpoint, unknown student | 404 |
| 10 | `GET /health` with Postgres running | `200 {"status":"ok","db":"ok",...}` |
| 11 | `GET /health` with Postgres stopped | `503 {"status":"error","db":"unreachable",...}` |
| 12 | `loadSecrets()` against real Azure Key Vault (`bad-kv`) with `ALLOW_LOCAL_DEV_SECRETS` unset | Correctly refuses to boot instead of silently falling back |

## Not yet tested

- **Real Gemini AI generation** — verified only that failure degrades gracefully (step 3 above); a real key is now in Key Vault but hasn't been exercised end-to-end yet.
- **Real EduCore** — only the mock has been tested; the actual contract (`docs/educore-contract.md`) is unconfirmed.
- **Production VPS deployment** — verified locally only; Nginx routing, HTTPS, and the deployed environment haven't been tested yet.
