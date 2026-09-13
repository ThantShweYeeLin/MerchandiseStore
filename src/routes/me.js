const express = require("express");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Returns the signed-in user's authoritative record from our own database —
// the frontend derives an initial guess for role/department straight from
// Entra token claims (app-role assignments), but role can also come from
// AD_ADMIN_EMAILS (a backend-only mechanism Entra knows nothing about), and
// department is admin-assigned (see PATCH /admin/users/:id/department). This
// is how the frontend finds out the real values after sign-in.
router.get("/", requireAuth, (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    displayName: req.user.displayName,
    department: req.user.department,
    role: req.user.role,
  });
});

module.exports = router;
