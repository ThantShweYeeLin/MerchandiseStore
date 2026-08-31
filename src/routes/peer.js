const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { requirePeerApiKey } = require("../middleware/rbac");
const { getSecret } = require("../config/keyvault");

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /store/peer/students/:studentId/orders
 * Consumed by EduCore for their own department-enrollment reporting.
 * Protected by a static x-api-key we generated and issued to EduCore only.
 * Returns a summary — no payment details, nothing beyond what EduCore needs.
 */
router.get(
  "/students/:studentId/orders",
  requirePeerApiKey(() => getSecret("EDUCORE-INBOUND-KEY")),
  async (req, res, next) => {
    try {
      const { studentId } = req.params; // AD object id

      const user = await prisma.user.findUnique({ where: { adObjectId: studentId } });
      if (!user) return res.status(404).json({ error: "Unknown student" });

      const orders = await prisma.order.findMany({
        where: { userId: user.id },
        include: { items: { include: { product: { include: { category: true } } } } },
      });

      const orderCount = orders.length;
      const totalSpend = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);

      const discountUsageByDepartment = {};
      for (const order of orders) {
        if (!order.discountApplied) continue;
        for (const item of order.items) {
          const dept = item.product.category?.name;
          if (!dept) continue;
          discountUsageByDepartment[dept] = (discountUsageByDepartment[dept] || 0) + 1;
        }
      }

      res.json({
        studentId,
        orderCount,
        totalSpend,
        discountUsageByDepartment,
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
