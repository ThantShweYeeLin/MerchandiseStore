const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// University AD (Azure AD / Entra ID) OIDC JWKS endpoint. Set via Key Vault
// or, for the tenant-level metadata endpoints (not secrets), plain env config.
const client = jwksClient({
  jwksUri: process.env.AD_JWKS_URI, // e.g. https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys
});

function getSigningKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

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
      issuer: process.env.AD_ISSUER,
      algorithms: ["RS256"],
    },
    async (err, decoded) => {
      if (err) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }

      try {
        const user = await prisma.user.upsert({
          where: { adObjectId: decoded.oid },
          update: {
            email: decoded.preferred_username || decoded.email,
            displayName: decoded.name,
          },
          create: {
            adObjectId: decoded.oid,
            email: decoded.preferred_username || decoded.email,
            displayName: decoded.name,
            department: decoded.department || null,
            role: mapAdGroupsToRole(decoded.roles || decoded.groups || []),
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
function mapAdGroupsToRole(groupsOrRoles) {
  if (groupsOrRoles.includes("MerchStoreAdmin")) return "ADMIN";
  if (groupsOrRoles.includes("MerchStoreStaff")) return "STAFF";
  return "STUDENT";
}

module.exports = { requireAuth };
