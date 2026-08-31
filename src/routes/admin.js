const crypto = require("crypto");
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const { rotateSecret } = require("../config/keyvault");
const { recordAudit } = require("../utils/auditLog");

const router = express.Router();
const prisma = new PrismaClient();

const ASSIGNABLE_ROLES = ["STUDENT", "STAFF", "ADMIN"];

// ADMIN only: view the audit trail.
router.get("/audit-log", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: { select: { id: true, displayName: true, email: true } } },
    });
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

// ADMIN only: override a user's role (roles otherwise sync from AD group
// claims on login — this is for manual correction/edge cases).
router.patch("/users/:id/role", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!ASSIGNABLE_ROLES.includes(role)) {
      return res.status(400).json({ error: `role must be one of ${ASSIGNABLE_ROLES.join(", ")}` });
    }

    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "User not found" });

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
    });

    await recordAudit({
      userId: req.user.id,
      action: "USER_ROLE_UPDATED",
      entityType: "User",
      entityId: user.id,
    });

    res.json(user);
  } catch (err) {
    next(err);
  }
});

// ADMIN only: rotate the static key issued to EduCore for the inbound peer
// endpoint. Returns the new key once — it is not retrievable again.
router.post(
  "/educore-inbound-key/rotate",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const newKey = crypto.randomBytes(32).toString("hex");
      await rotateSecret("EDUCORE-INBOUND-KEY", newKey);

      await recordAudit({
        userId: req.user.id,
        action: "EDUCORE_INBOUND_KEY_ROTATED",
        entityType: "ApiKey",
        entityId: "EDUCORE-INBOUND-KEY",
      });

      res.json({ rotated: true, newKey });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
