const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const { generateProductDescription } = require("../services/aiDescription");
const { recordAudit } = require("../utils/auditLog");

const router = express.Router();
const prisma = new PrismaClient();

// Students and staff can browse the catalog
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      include: { category: true, images: true },
    });
    res.json(products);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: { category: true, images: true },
    });
    if (!product) return res.status(404).json({ error: "Not found" });
    res.json(product);
  } catch (err) {
    next(err);
  }
});

// STAFF/ADMIN only: create — auto-drafts the description via the AI API
router.post("/", requireAuth, requireRole("STAFF", "ADMIN"), async (req, res, next) => {
  try {
    const { name, slug, price, categoryId, imageUrl, stock } = req.body;

    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) return res.status(400).json({ error: "Invalid categoryId" });

    let description;
    try {
      description = await generateProductDescription({ name, categoryName: category.name });
    } catch (aiErr) {
      description = null; // catalog creation should not hard-fail if the AI API is down
    }

    const product = await prisma.product.create({
      data: {
        name,
        slug,
        price,
        categoryId,
        imageUrl,
        stock: stock ?? 0,
        description,
        createdById: req.user.id,
      },
    });

    await recordAudit({
      userId: req.user.id,
      action: "PRODUCT_CREATE",
      entityType: "Product",
      entityId: product.id,
    });

    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
});

// STAFF/ADMIN only: update — regenerates the description
router.put("/:id", requireAuth, requireRole("STAFF", "ADMIN"), async (req, res, next) => {
  try {
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Not found" });

    const { name, price, categoryId, imageUrl, stock } = req.body;
    const category = await prisma.category.findUnique({
      where: { id: categoryId ?? existing.categoryId },
    });

    let description = existing.description;
    if (name && name !== existing.name) {
      try {
        description = await generateProductDescription({
          name,
          categoryName: category.name,
        });
      } catch (aiErr) {
        // keep prior description if regeneration fails
      }
    }

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { name, price, categoryId, imageUrl, stock, description },
    });

    await recordAudit({
      userId: req.user.id,
      action: "PRODUCT_UPDATE",
      entityType: "Product",
      entityId: product.id,
    });

    res.json(product);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
