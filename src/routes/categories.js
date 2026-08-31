const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const { recordAudit } = require("../utils/auditLog");

const router = express.Router();
const prisma = new PrismaClient();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany();
    res.json(categories);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, requireRole("STAFF", "ADMIN"), async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const category = await prisma.category.create({ data: { name, description } });

    await recordAudit({
      userId: req.user.id,
      action: "CATEGORY_CREATE",
      entityType: "Category",
      entityId: category.id,
    });

    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
});

// ADMIN only: categories are shared across products, so re-tagging is a
// higher-stakes edit than STAFF's day-to-day product CRUD.
router.put("/:id", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const existing = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Not found" });

    const { name, description } = req.body;
    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: { name, description },
    });

    await recordAudit({
      userId: req.user.id,
      action: "CATEGORY_UPDATE",
      entityType: "Category",
      entityId: category.id,
    });

    res.json(category);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const existing = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Not found" });

    await prisma.category.delete({ where: { id: req.params.id } });

    await recordAudit({
      userId: req.user.id,
      action: "CATEGORY_DELETE",
      entityType: "Category",
      entityId: req.params.id,
    });

    res.status(204).end();
  } catch (err) {
    // Foreign key constraint: category still has products tagged to it.
    if (err.code === "P2003") {
      return res.status(409).json({ error: "Cannot delete a category that still has products" });
    }
    next(err);
  }
});

module.exports = router;
