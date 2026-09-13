const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const { generateProductDescription } = require("../services/aiDescription");

const router = express.Router();

// STAFF/ADMIN only: draft a product description on demand — called when
// staff click "Generate" while creating/editing a product (see
// AdminCatalog.jsx), not automatically on save. Calling this again returns
// a fresh draft (the model's output varies call to call); the result is
// never saved here — it's just handed back for the form to show and let
// staff edit before actually saving the product.
router.post("/generate-description", requireAuth, requireRole("STAFF", "ADMIN"), async (req, res, next) => {
  try {
    const { name, categoryName, category } = req.body;
    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }

    const description = await generateProductDescription({
      name,
      categoryName: categoryName || category || "General",
    });
    res.json({ description });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
