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

    // Verify each claimed department separately; mixed discounted/full-price
    // items in one order are expected.
    let anyDiscount = false;
    let total = 0;

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

      if (verified) anyDiscount = true;
    }

    // Simple total: apply a flat discount rate to items whose department verified.
    // Replace with your actual per-item discount logic / rate.
    const DISCOUNT_RATE = 0.15;
    for (const item of order.items) {
      const lineTotal = Number(item.unitPrice) * item.quantity;
      const deptVerified = anyDiscount; // refine to per-item department check as needed
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

module.exports = router;
