# Testing Evidence

Two layers of testing exist for this project: an automated Jest suite (unit
level, Prisma/EduCore mocked), and live end-to-end verification against real
Postgres over real HTTP (auth mocked via `mock-ad/`; the peer-service call
made via `mock-educore/` in `public-api` mode, which itself makes a real
call to a public API — see [Peer API Documentation](../README.md#peer-api-documentation)
for why a public API is used here instead of a classmate's service, per
updated course requirements). Both layers are recorded here.

## Automated test suite

```
npx jest
```
41 tests across 5 suites, all passing as of the latest commit:

| Suite | Covers |
|---|---|
| `tests/products.test.js` | Product CRUD, AI description generation + failure fallback, image add/remove, RBAC |
| `tests/categories.test.js` | Category CRUD, RBAC (ADMIN-only for PUT/DELETE) |
| `tests/orders.test.js` | Order placement, per-department discount correctness (including the mixed-department case), STAFF/ADMIN order visibility, RBAC |
| `tests/peer.test.js` | EduCore-facing summary endpoint, auth, per-department discount usage accuracy |
| `tests/admin.test.js` | Audit log access, user listing, role override, EduCore key rotation, RBAC |

## Live end-to-end verification (real HTTP, real Postgres, real public API call)

Run using `mock-ad/server.js` (fake AD/JWKS, mints real RS256 JWTs) and
`mock-educore/server.js` in `MOCK_EDUCORE_MODE=public-api` (makes a real
call to JSONPlaceholder to decide enrollment), against a real Postgres
container — no jest, no mocked Prisma, no mocked HTTP.

| Step | Action | Result |
|---|---|---|
| 1 | Staff login via mock AD | Valid JWT issued and accepted by `requireAuth` |
| 2 | `POST /categories` (Computer Science, Business) as STAFF | 201 both |
| 3 | `POST /products` (CS Hoodie $50, Business Jacket $80) as STAFF | 201 both; AI call made with placeholder key → `description: null`, product still created (graceful fallback proven) |
| 4 | Student `ad-student-3` (dept: Business) logs in, orders the Business Jacket | 201; real call to JSONPlaceholder (`todo #56`, `completed: true`) → `verified: true`; `totalAmount: 68` (15% off $80); `discountApplied: true` |
| 5 | Student `ad-student-1` (dept: Computer Science) logs in, orders the CS Hoodie | 201; real call to JSONPlaceholder (`todo #124`, `completed: false`) → `verified: false`; `totalAmount: 50` (full price); `discountApplied: false` |
| 6 | Admin login, `GET /admin/audit-log` | Returns all 6 actions from steps 2–5 in order — full trail present |
| 7 | `GET /peer/students/:id/orders` with correct `x-api-key` | 200, accurate summary |
| 8 | Same endpoint, wrong `x-api-key` | 401 |
| 9 | Same endpoint, unknown student | 404 |
| 10 | `GET /health` with Postgres running | `200 {"status":"ok","db":"ok",...}` |
| 11 | `GET /health` with Postgres stopped | `503 {"status":"error","db":"unreachable",...}` |

This demonstrates both discount outcomes (enrolled/denied) driven by a real
external network call, not a hardcoded answer — the same pattern a real
peer-service integration would use, per the updated requirement that a
public API is sufficient to demonstrate this capability.

## Not yet tested / not currently applicable

- **Real Gemini AI generation** — only the failure-fallback path is proven (step 3 above). The real Key Vault (`bad-kv`) currently has no working AI key in it — an Azure RBAC permission gap (the app's service principal can read secrets but not write them) is blocking this; local dev is unaffected since it uses `ALLOW_LOCAL_DEV_SECRETS` instead.
- **Real EduCore** — no longer required for grading per updated course requirements; `docs/educore-contract.md` remains as the design target if a real one ever becomes available.
- **Production VPS deployment** — not currently running by design (the Azure VM is being kept deleted between uses for cost reasons, per course guidance); will be verified when redeployed specifically for the final video recording.
