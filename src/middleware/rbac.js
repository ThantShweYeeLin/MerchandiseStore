/**
 * Usage: router.post("/products", requireAuth, requireRole("STAFF", "ADMIN"), handler)
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

/**
 * Validates a static x-api-key header for server-to-server calls (EduCore -> us).
 * Compares against the key we generated and issued to EduCore, stored in Key Vault.
 */
function requirePeerApiKey(getExpectedKey) {
  return (req, res, next) => {
    const provided = req.headers["x-api-key"];
    const expected = getExpectedKey();
    if (!provided || provided !== expected) {
      return res.status(401).json({ error: "Invalid or missing x-api-key" });
    }
    next();
  };
}

module.exports = { requireRole, requirePeerApiKey };
