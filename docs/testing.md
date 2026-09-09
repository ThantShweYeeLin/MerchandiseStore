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
| 2 | `POST /categories` (Computer Science, Business, Engineering) as STAFF | 201 all |
| 3 | `POST /products` (CS Jacket, Business Tote, Engineering Mug) as STAFF | 201 all; AI call made with placeholder key → `description: null`, product still created (graceful fallback proven) |
| 4 | Student `ad-student-3` (roster dept: Business) orders the Business Tote | 201; roster match → `verified: true`; 15% off, `discountApplied: true` |
| 5 | Student `ad-student-1` (roster dept: Computer Science) orders the CS Jacket | 201; roster match → `verified: true`; 15% off, `discountApplied: true` |
| 6 | **Same student (`ad-student-1`) orders the CS Jacket + Business Tote + Engineering Mug in one order** | 201; `peerVerificationLogs`: `Computer Science: true`, `Business: false`, `Engineering: false` — only the CS item discounted, proving the check is per-department per-student, not blanket |
| 7 | An unregistered studentId orders a Business item, claiming department "Business" | `verified: false` — no roster entry means no discount, deterministically (not a coin flip) |
| 8 | Admin login, `GET /admin/audit-log` | Full trail of every category/product/order action present |
| 9 | `GET /peer/students/:id/orders` with correct `x-api-key` | 200, accurate summary |
| 10 | Same endpoint, wrong `x-api-key` | 401 |
| 11 | Same endpoint, unknown student | 404 |
| 12 | `GET /health` with Postgres running / stopped | `200 {"db":"ok"}` / `503 {"db":"unreachable"}` |

**Bug found and fixed during this testing**: the first version of the
public-API demo mode derived verified/not-verified from a hash of
`(studentId, department)` fed into a public API response — which meant the
same student could randomly "pass" for departments they have nothing to do
with (e.g. a Computer Science student getting a Business discount purely by
hash luck), independent of any real enrollment. Fixed by adding a roster
mapping each demo student to their one real department; the public API call
still happens and is logged (satisfying "demonstrate a real external call"),
but no longer controls who gets a discount. Step 6 above is the regression
test for this — verified live after the fix.

## Not yet tested / not currently applicable

- **Real Gemini AI generation** — only the failure-fallback path is proven (step 3 above). The real Key Vault (`bad-kv`) currently has no working AI key in it — an Azure RBAC permission gap (the app's service principal can read secrets but not write them) is blocking this; local dev is unaffected since it uses `ALLOW_LOCAL_DEV_SECRETS` instead.
- **Real EduCore** — no longer required for grading per updated course requirements; `docs/educore-contract.md` remains as the design target if a real one ever becomes available.
- **Production VPS deployment** — not currently running by design (the Azure VM is being kept deleted between uses for cost reasons, per course guidance); will be verified when redeployed specifically for the final video recording.
