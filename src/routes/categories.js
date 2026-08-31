const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");

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
    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
