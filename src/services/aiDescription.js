const axios = require("axios");
const { getSecret } = require("../config/keyvault");

/**
 * Calls a third-party AI text-generation API to draft an SEO-friendly product
 * description from the product name + category. Swap the URL/payload shape
 * for whichever provider you pick (OpenAI, Gemini, etc.) — this stub uses a
 * generic chat-completions style call.
 */
async function generateProductDescription({ name, categoryName }) {
  const apiKey = getSecret("AI-API-KEY");

  const prompt =
    `Write a short, SEO-friendly product description (2-3 sentences) for a ` +
    `university merchandise item called "${name}" in the "${categoryName}" category. ` +
    `Friendly, upbeat tone, no emojis.`;

  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 150,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 8000,
    }
  );

  return response.data.choices[0].message.content.trim();
}

module.exports = { generateProductDescription };
