# EduCore Integration Contract — Draft v1

**Status: draft, unconfirmed by the EduCore team.** Everything here reflects
what this project's code currently assumes (`src/services/eduCoreClient.js`,
`src/routes/peer.js`) — not a contract EduCore has agreed to. Update this
file and the corresponding code together once EduCore confirms their actual
API.

## Open questions to resolve with the EduCore team

1. **Student identifier** — we currently send the AD Object ID (a GUID, from
   the `oid` claim in the AD-issued JWT). Does EduCore expect this, or a
   university student ID number, email, or something else? Since both
   systems likely authenticate against the same university AD, the AD
   Object ID may already be what EduCore uses internally — don't assume
   otherwise without confirming.
2. **Department naming** — we send a product's `Category.name` verbatim
   (e.g. `"Computer Science"`). Does EduCore's enrollment data use the same
   strings, or department codes (`"CS"`)? A mismatch here fails silently:
   both APIs work, verification just always returns false.
3. **EduCore's actual base URL and endpoint path** — `/enrollment/verify`
   below is our assumption, not theirs.
4. **HTTP method and payload shape** — we assume `GET` with query params;
   confirm EduCore doesn't expect `POST` with a JSON body instead.

## What we consume from EduCore (enrollment verification)

**Request** (assumed)
```
GET {EDUCORE_BASE_URL}/enrollment/verify?studentId={id}&department={department}
Headers:
  x-api-key: {EDUCORE_API_KEY}
Timeout: 5000ms
```

**Response — enrolled**
```json
{ "verified": true }
```

**Response — not enrolled**
```json
{ "verified": false }
```

**Rules**
- Called once per distinct department claimed by items in an order, not
  once per order — mixed discounted/full-price items in one order are
  expected and correct.
- If the request fails for any reason (timeout, network error, non-2xx,
  malformed response), the store fails closed: `verified: false`, full
  price, no crash.
- Every call — success, denial, or failure — is recorded as its own
  `PeerVerificationLog` row, tied to both the order and the student.

## What we expose for EduCore (their reporting)

**Request**
```
GET /store/peer/students/{studentId}/orders
Headers:
  x-api-key: {EDUCORE_INBOUND_KEY}   (issued by us, rotatable by ADMIN)
```

**Response**
```json
{
  "studentId": "...",
  "orderCount": 5,
  "totalSpend": 320,
  "discountUsageByDepartment": { "Computer Science": 2 }
}
```
No payment details or line-item detail — only the aggregate EduCore needs
for their own department reporting.

**Errors**: `401` for a missing/wrong `x-api-key`, `404` for an unknown
`studentId`.

## Testing this contract today

`mock-educore/server.js` implements exactly the assumed contract above, so
the store's side of this integration can be built and tested without
waiting on EduCore's real service:
```bash
node mock-educore/server.js
EDUCORE_BASE_URL=http://localhost:4000 npm run dev
```
