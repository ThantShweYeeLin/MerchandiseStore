// The Render free tier spins the backend down after ~15 minutes idle. The
// first request after that either fails outright or gets a bare 502 from
// Render's own edge proxy (before our app's CORS headers ever get attached),
// which the browser reports as a generic "Failed to fetch" — not a status
// code we can even read. A short, single retry is enough to land the second
// attempt after the container has finished booting.
const COLD_START_RETRY_DELAY_MS = 2000;
const RETRYABLE_STATUSES = new Set([502, 503, 504]);

// Only for reads (GET) — safe to retry silently since nothing is mutated.
// Mutations (POST/PATCH/DELETE) intentionally don't use this: a network
// failure there might mean the request actually reached the server, and
// blindly retrying could double up a real side effect (e.g. placing an
// order twice).
export async function fetchWithRetry(url, options) {
  try {
    const res = await fetch(url, options);
    if (RETRYABLE_STATUSES.has(res.status)) {
      await sleep(COLD_START_RETRY_DELAY_MS);
      return fetch(url, options);
    }
    return res;
  } catch {
    // A thrown error here is a network-level failure (connection refused/
    // reset, or a CORS check that failed because the error response carried
    // no CORS headers) — exactly what a cold-starting backend looks like.
    await sleep(COLD_START_RETRY_DELAY_MS);
    return fetch(url, options);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
