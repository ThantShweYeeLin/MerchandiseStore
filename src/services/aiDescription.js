const axios = require("axios");
const { getSecret } = require("../config/keyvault");

const GEMINI_MODEL = "gemini-3.6-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Calls Google's Gemini API to draft an SEO-friendly product description
 * from the product name + category. AI-API-KEY is a Gemini API key from
 * Google AI Studio (https://aistudio.google.com/apikey).
 */
async function generateProductDescription({ name, categoryName }) {
  const apiKey = getSecret("AI-API-KEY");

  const prompt =
    `Write one short, punchy, SEO-friendly sentence (under 20 words) describing a ` +
    `university merchandise item called "${name}" in the "${categoryName}" category. ` +
    `Friendly, upbeat tone, no emojis. Return only that one sentence, nothing else.`;

  let response;
  try {
    response = await axios.post(
      GEMINI_URL,
      {
        // gemini-3.6-flash spends a variable, often large, number of tokens on
        // hidden reasoning before writing the visible answer (thoughtsTokenCount
        // in the response) — observed anywhere from ~50 to ~600 tokens of
        // thinking across otherwise-identical calls, so even 600 total wasn't
        // always enough headroom and would truncate the real answer mid-word.
        // 1200 leaves enough room for the reasoning plus a full 2-3 sentence
        // description even on a high-thinking call.
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1200 },
      },
      {
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        // Generous enough for the above reasoning + generation time; a slow/failed
        // call still just falls back to description: null (see products.js), never
        // blocks product creation.
        timeout: 30000,
      }
    );
  } catch (err) {
    if (err.response?.status === 429) {
      // The free tier caps this model at a small number of requests per
      // *day* (not per minute) — retrying immediately never helps here,
      // only waiting for the quota to reset or switching to a paid key does.
      throw new Error(
        "Gemini's free-tier daily quota for this API key is used up for now — try again later, or use a key with billing enabled."
      );
    }
    throw err;
  }

  const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no usable text (likely truncated by the token budget)");
  return text.trim();
}

module.exports = { generateProductDescription };
