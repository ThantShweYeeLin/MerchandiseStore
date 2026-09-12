const express = require("express");
const { GoogleGenAI } = require("@google/genai");

const router = express.Router();

router.post("/generate-description", async (req, res) => {
  try {
    // Check Gemini API key
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured",
      });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const { name, category, price } = req.body;

    if (!name) {
      return res.status(400).json({
        error: "Product name is required",
      });
    }

    const prompt = `
Generate an SEO-friendly product description for an e-commerce website.

Product name: ${name}
Category: ${category || "Not specified"}
Price: ${price || "Not specified"}

Requirements:
- Write 80-120 words.
- Make it natural and professional.
- Make it SEO-friendly.
- Include relevant keywords naturally.
- Do not invent product specifications.
- Do not mention that AI generated the description.
- Return only the product description.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
    });

    res.json({
      description: response.text,
    });

  } catch (error) {
    console.error("Gemini API error:", error);

    res.status(500).json({
      error: error.message || "Failed to generate product description",
    });
  }
});

module.exports = router;