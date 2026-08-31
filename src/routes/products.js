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

// STAFF/ADMIN only: delete
router.delete("/:id", requireAuth, requireRole("STAFF", "ADMIN"), async (req, res, next) => {
  try {
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Not found" });

    // Photos are pure sub-resources of the product, not an independent
    // reason to block deletion — clear them first so a remaining P2003 can
    // only mean the product is still referenced by an order.
    await prisma.$transaction([
      prisma.productImage.deleteMany({ where: { productId: req.params.id } }),
      prisma.product.delete({ where: { id: req.params.id } }),
    ]);

    await recordAudit({
      userId: req.user.id,
      action: "PRODUCT_DELETE",
      entityType: "Product",
      entityId: req.params.id,
    });

    res.status(204).end();
  } catch (err) {
    // Foreign key constraint: product is still referenced by existing order items.
    if (err.code === "P2003") {
      return res.status(409).json({ error: "Cannot delete a product that has existing orders" });
    }
    next(err);
  }
});

// STAFF/ADMIN only: add a photo to a product
router.post("/:productId/images", requireAuth, requireRole("STAFF", "ADMIN"), async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.productId } });
    if (!product) return res.status(404).json({ error: "Product not found" });

    const { url, sortOrder } = req.body;
    if (!url) return res.status(400).json({ error: "url is required" });

    const image = await prisma.productImage.create({
      data: { productId: req.params.productId, url, sortOrder: sortOrder ?? 0 },
    });

    await recordAudit({
      userId: req.user.id,
      action: "PRODUCT_IMAGE_CREATE",
      entityType: "ProductImage",
      entityId: image.id,
    });

    res.status(201).json(image);
  } catch (err) {
    next(err);
  }
});

// STAFF/ADMIN only: remove a photo from a product
router.delete(
  "/:productId/images/:imageId",
  requireAuth,
  requireRole("STAFF", "ADMIN"),
  async (req, res, next) => {
    try {
      const image = await prisma.productImage.findUnique({ where: { id: req.params.imageId } });
      if (!image || image.productId !== req.params.productId) {
        return res.status(404).json({ error: "Image not found" });
      }

      await prisma.productImage.delete({ where: { id: req.params.imageId } });

      await recordAudit({
        userId: req.user.id,
        action: "PRODUCT_IMAGE_DELETE",
        entityType: "ProductImage",
        entityId: req.params.imageId,
      });

      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
