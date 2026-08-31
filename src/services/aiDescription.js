const axios = require("axios");
const { getSecret } = require("../config/keyvault");

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Calls Google's Gemini API to draft an SEO-friendly product description
 * from the product name + category. AI-API-KEY is a Gemini API key from
 * Google AI Studio (https://aistudio.google.com/apikey).
 */
async function generateProductDescription({ name, categoryName }) {
  const apiKey = getSecret("AI-API-KEY");

  const prompt =
    `Write a short, SEO-friendly product description (2-3 sentences) for a ` +
    `university merchandise item called "${name}" in the "${categoryName}" category. ` +
    `Friendly, upbeat tone, no emojis.`;

  const response = await axios.post(
    GEMINI_URL,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 150 },
    },
    {
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      timeout: 8000,
    }
  );

  return response.data.candidates[0].content.parts[0].text.trim();
}

module.exports = { generateProductDescription };
