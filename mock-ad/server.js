// Local stand-in for university AD/SSO, for testing login + RBAC end-to-end
// without real AD access. Serves a JWKS endpoint (so src/middleware/auth.js's
// jwks-rsa client can fetch a signing key) and mints RS256 JWTs shaped like
// what that middleware expects: `oid` (-> adObjectId), `preferred_username`
// (-> email), `name` (-> displayName), `roles` (-> mapped to STUDENT/STAFF/
// ADMIN — see mapAdGroupsToRole in auth.js).
//
// Run: node mock-ad/server.js
// Then point the real app at it:
//   AD_JWKS_URI=http://localhost:4001/discovery/v2.0/keys
//   AD_ISSUER=http://localhost:4001
//   AD_CLIENT_ID=mock-client-id
//
// Mint a token:
//   curl -X POST http://localhost:4001/mock-login -H "Content-Type: application/json" \
//     -d '{"role":"STAFF","adObjectId":"ad-staff-1","email":"staff@example.edu"}'

const crypto = require("crypto");
const express = require("express");
const jwt = require("jsonwebtoken");

const PORT = process.env.MOCK_AD_PORT || 4001;
const ISSUER = process.env.MOCK_AD_ISSUER || `http://localhost:${PORT}`;
const AUDIENCE = process.env.MOCK_AD_AUDIENCE || "mock-client-id";
const KID = "mock-ad-key-1";

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
const jwk = crypto.createPublicKey(publicKey).export({ format: "jwk" });

// Mirrors mapAdGroupsToRole in src/middleware/auth.js.
const ROLE_GROUPS = {
  ADMIN: ["MerchStoreAdmin"],
  STAFF: ["MerchStoreStaff"],
  STUDENT: [],
};

const app = express();
app.use(express.json());

app.get("/discovery/v2.0/keys", (req, res) => {
  res.json({ keys: [{ ...jwk, kid: KID, use: "sig", alg: "RS256" }] });
});

app.post("/mock-login", (req, res) => {
  const { role = "STUDENT", adObjectId, email, name, department } = req.body;

  if (!ROLE_GROUPS[role]) {
    return res.status(400).json({ error: `role must be one of ${Object.keys(ROLE_GROUPS).join(", ")}` });
  }
  if (!adObjectId || !email) {
    return res.status(400).json({ error: "adObjectId and email are required" });
  }

  const token = jwt.sign(
    {
      oid: adObjectId,
      preferred_username: email,
      name: name || email,
      department: department || null,
      roles: ROLE_GROUPS[role],
    },
    privateKey,
    { algorithm: "RS256", keyid: KID, issuer: ISSUER, audience: AUDIENCE, expiresIn: "2h" }
  );

  res.json({ token });
});

app.listen(PORT, () => {
  console.log(`Mock AD listening on port ${PORT}`);
  console.log("Set in your app's env:");
  console.log(`  AD_JWKS_URI=${ISSUER}/discovery/v2.0/keys`);
  console.log(`  AD_ISSUER=${ISSUER}`);
  console.log(`  AD_CLIENT_ID=${AUDIENCE}`);
});
