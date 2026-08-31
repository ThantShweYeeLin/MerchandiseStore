const axios = require("axios");
const { getSecret } = require("../config/keyvault");

// Base URL of your classmate's EduCore service. Set this once you know their
// deployed path (e.g. https://your-domain.com/educore).
const EDUCORE_BASE_URL = process.env.EDUCORE_BASE_URL;

/**
 * Verifies that `studentId` (AD id) is enrolled in `department`.
 * Called once per distinct department present in an order.
 * On any failure (timeout, non-2xx, network error), verified defaults to
 * false so the item stays at full price — never fail open on a discount.
 */
async function verifyEnrollment({ studentId, department }) {
  const apiKey = getSecret("EDUCORE-API-KEY");

  try {
    const response = await axios.get(
      `${EDUCORE_BASE_URL}/enrollment/verify`,
      {
        params: { studentId, department },
        headers: { "x-api-key": apiKey },
        timeout: 5000,
      }
    );
    return {
      verified: Boolean(response.data.verified),
      raw: response.data,
    };
  } catch (err) {
    return {
      verified: false,
      raw: { error: err.message },
    };
  }
}

module.exports = { verifyEnrollment };
