const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const { verifyEnrollment } = require("../services/eduCoreClient");
const { recordAudit } = require("../utils/auditLog");

const router = express.Router();
const prisma = new PrismaClient();

// STUDENT: place an order. Body: { items: [{ productId, quantity }] }
router.post("/", requireAuth, requireRole("STUDENT"), async (req, res, next) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items is required" });
    }

    const products = await prisma.product.findMany({
      where: { id: { in: items.map((i) => i.productId) } },
      include: { category: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Departments referenced by the items in this order (e.g. product name/category
    // implies a department claim — adjust this mapping to match your catalog's
    // department-tagging scheme).
    const departmentsInOrder = [
      ...new Set(
        items
          .map((i) => productMap.get(i.productId)?.category?.name)
          .filter(Boolean)
      ),
    ];

    const order = await prisma.order.create({
      data: {
        userId: req.user.id,
        status: "PENDING",
        totalAmount: 0, // computed below
        items: {
          create: items.map((i) => {
            const product = productMap.get(i.productId);
            return {
              productId: i.productId,
              quantity: i.quantity,
              unitPrice: product.price,
            };
          }),
        },
      },
      include: { items: { include: { product: true } } },
    });

    // Verify each claimed department separately and remember its own result —
    // one order can end up with a mix of discounted and full-price items
    // depending on which departments EduCore actually verified.
    const departmentVerified = {};

    for (const department of departmentsInOrder) {
      const { verified, raw } = await verifyEnrollment({
        studentId: req.user.adObjectId,
        department,
      });

      await prisma.peerVerificationLog.create({
        data: {
          orderId: order.id,
          studentId: req.user.adObjectId,
          department,
          verified,
          peerApiResponse: raw,
        },
      });

      departmentVerified[department] = verified;
    }

    const DISCOUNT_RATE = 0.15;
    let anyDiscount = false;
    let total = 0;
    for (const item of order.items) {
      const department = productMap.get(item.productId)?.category?.name;
      const lineTotal = Number(item.unitPrice) * item.quantity;
      const deptVerified = Boolean(department && departmentVerified[department]);
      if (deptVerified) anyDiscount = true;
      total += deptVerified ? lineTotal * (1 - DISCOUNT_RATE) : lineTotal;
    }

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: { totalAmount: total, discountApplied: anyDiscount },
      include: { items: true, peerVerificationLogs: true },
    });

    await recordAudit({
      userId: req.user.id,
      action: "ORDER_PLACED",
      entityType: "Order",
      entityId: order.id,
    });

    res.status(201).json(updatedOrder);
  } catch (err) {
    next(err);
  }
});

router.get("/mine", requireAuth, requireRole("STUDENT"), async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      include: { items: true },
    });
    res.json(orders);
  } catch (err) {
    next(err);
  }
});

// STAFF: orders containing at least one item from their own department.
// ADMIN: every order, regardless of department.
router.get("/", requireAuth, requireRole("STAFF", "ADMIN"), async (req, res, next) => {
  try {
    const where =
      req.user.role === "ADMIN" || !req.user.department
        ? {}
        : {
            items: {
              some: { product: { category: { name: req.user.department } } },
            },
          };

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: { include: { product: { include: { category: true } } } },
        user: { select: { id: true, displayName: true, email: true } },
      },
    });
    res.json(orders);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
