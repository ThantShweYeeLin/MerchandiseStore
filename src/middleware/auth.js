const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// University AD (Azure AD / Entra ID) OIDC JWKS endpoint. Set via Key Vault
// or, for the tenant-level metadata endpoints (not secrets), plain env config.
// Using the tenant-agnostic /common endpoint here (rather than one specific
// tenant's) since the app registration accepts any Microsoft account — the
// v2.0 signing keys served here are the same regardless of which real
// tenant issued a given token, so this works for verifying all of them.
const client = jwksClient({
  jwksUri: process.env.AD_JWKS_URI, // e.g. https://login.microsoftonline.com/common/discovery/v2.0/keys
});

function getSigningKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

// The app accepts sign-in from any Microsoft account (any org tenant, or a
// personal account), so the token's `iss` claim varies per real signer —
// there's no single fixed issuer string to check against. Signature
// (via JWKS above) and audience are still verified per-token; this just
// confirms the issuer is shaped like a genuine Microsoft v2.0 endpoint.
const MICROSOFT_ISSUER_PATTERN = /^https:\/\/login\.microsoftonline\.com\/[0-9a-f-]+\/v2\.0$/i;

/**
 * Verifies the AD-issued access token, then syncs/loads the local User row
 * (first login provisions the row from token claims). Attaches req.user.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  jwt.verify(
    token,
    getSigningKey,
    {
      audience: process.env.AD_CLIENT_ID,
      algorithms: ["RS256"],
    },
    async (err, decoded) => {
      // TEMPORARY debug logging — remove once sign-in is confirmed working.
      if (err) {
        console.error("[auth debug] jwt.verify failed:", err.name, err.message);
      } else if (!MICROSOFT_ISSUER_PATTERN.test(decoded?.iss || "")) {
        console.error("[auth debug] issuer pattern rejected. iss =", decoded?.iss, "aud =", decoded?.aud);
      }
      if (err || !MICROSOFT_ISSUER_PATTERN.test(decoded?.iss || "")) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }

      try {
        const user = await prisma.user.upsert({
          where: { adObjectId: decoded.oid },
          update: {
            email: decoded.preferred_username || decoded.email,
            displayName: decoded.name,
            ...(isConfiguredAdmin(decoded) ? { role: "ADMIN" } : {}),
          },
          create: {
            adObjectId: decoded.oid,
            email: decoded.preferred_username || decoded.email,
            displayName: decoded.name,
            department: decoded.department || null,
            role: mapAdGroupsToRole(decoded),
          },
        });

        req.user = user;
        next();
      } catch (dbErr) {
        next(dbErr);
      }
    }
  );
}

/**
 * Maps AD security group / app role claims onto our internal Role enum.
 * Adjust the group names to match what's configured in the university AD app registration.
 */
function mapAdGroupsToRole(decoded) {
  if (isConfiguredAdmin(decoded)) return "ADMIN";
  const groupsOrRoles = decoded.roles || decoded.groups || [];
  if (groupsOrRoles.includes("MerchStoreAdmin")) return "ADMIN";
  if (groupsOrRoles.includes("MerchStoreStaff")) return "STAFF";
  return "STUDENT";
}

function isConfiguredAdmin(decoded) {
  const email = (decoded.preferred_username || decoded.email || "").toLowerCase();
  const configuredAdmins = (process.env.AD_ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return configuredAdmins.includes(email);
}

module.exports = { requireAuth };
