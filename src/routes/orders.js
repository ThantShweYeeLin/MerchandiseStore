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
    // depending on which departments get verified. A department an ADMIN has
    // assigned directly to this student (User.department) is trusted without
    // an EduCore call — that assignment is a deliberate admin decision, not
    // a student's own unverified claim. Anything else still goes through
    // EduCore as before.
    const departmentVerified = {};

    for (const department of departmentsInOrder) {
      const adminAssigned = req.user.department === department;
      let verified;
      let raw;

      if (adminAssigned) {
        verified = true;
        raw = { source: "admin-assigned-department" };
      } else {
        ({ verified, raw } = await verifyEnrollment({
          studentId: req.user.adObjectId,
          department,
        }));
      }

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

    let anyDiscount = false;
    let total = 0;
    for (const item of order.items) {
      const product = productMap.get(item.productId);
      const department = product?.category?.name;
      const discountRate = product?.discountRate ?? product?.category?.discountRate ?? 0.15;
      const lineTotal = Number(item.unitPrice) * item.quantity;
      const deptVerified = Boolean(department && departmentVerified[department]);
      if (deptVerified) anyDiscount = true;
      total += deptVerified ? lineTotal * (1 - discountRate) : lineTotal;
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
      orderBy: { createdAt: "desc" },
      include: { items: { include: { product: true } } },
    });
    res.json(orders);
  } catch (err) {
    next(err);
  }
});

// STAFF and ADMIN both see every order — department no longer scopes
// visibility (previously STAFF only saw orders touching their own
// department; removed per product decision so staff manage all students'
// orders, not just their own department's).
router.get("/", requireAuth, requireRole("STAFF", "ADMIN"), async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
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

const ASSIGNABLE_STATUSES = ["PENDING", "READY_FOR_PICKUP", "PAID", "CANCELLED"];

// STAFF/ADMIN only: mark an order ready for pickup (or any other status) so
// the student sees it reflected on their own order list.
router.patch("/:id/status", requireAuth, requireRole("STAFF", "ADMIN"), async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!ASSIGNABLE_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of ${ASSIGNABLE_STATUSES.join(", ")}` });
    }

    const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Order not found" });

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
    });

    await recordAudit({
      userId: req.user.id,
      action: "ORDER_STATUS_UPDATED",
      entityType: "Order",
      entityId: order.id,
    });

    res.json(order);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
