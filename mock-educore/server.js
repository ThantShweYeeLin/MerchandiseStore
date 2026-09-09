// Local stand-in for the real EduCore service, for testing this project's
// EduCore integration before the real EduCore team is reachable. Matches
// the actual contract src/services/eduCoreClient.js sends today:
//   GET {EDUCORE_BASE_URL}/enrollment/verify?studentId=...&department=...
//   header: x-api-key
//   response: { verified: boolean }
//
// This is an assumption of what EduCore's real contract will look like,
// not a confirmed one — update both this file and eduCoreClient.js
// together once the real EduCore team confirms their actual contract.
//
// Two modes, controlled by MOCK_EDUCORE_MODE:
//   "static" (default) — instant, offline, hardcoded roster. Best for
//     routine local dev since it has no external dependency.
//   "public-api" — makes a real call to a public API (JSONPlaceholder) so a
//     live demo shows a genuine outbound network call instead of an
//     obviously-fake local lookup, per the course's updated requirement
//     that a public API is sufficient to demonstrate this. IMPORTANT: the
//     actual verified/not-verified decision is NOT taken from the public
//     API's response — it has no real knowledge of university enrollment,
//     so treating it as the source of truth would make verification
//     effectively a coin flip per (student, department) pair, independent
//     of the student's real department. That was a real bug: it let a
//     student "pass" for departments they have nothing to do with, purely
//     by hash luck. The decision instead comes from ROSTER below (each
//     demo student's one real department) — realistic, deterministic, and
//     matches the proposal's actual requirement that a discount depends on
//     the *student's real enrollment*, not on which department a line item
//     happens to claim. The public API call still happens and is logged,
//     satisfying "demonstrate a real external call" without it silently
//     controlling who gets a discount.
//
// Run: node mock-educore/server.js
// Then point the real app at it: EDUCORE_BASE_URL=http://localhost:4000

const crypto = require("crypto");
const express = require("express"); // resolves from the project root's node_modules
const axios = require("axios");

const app = express();
const PORT = process.env.MOCK_EDUCORE_PORT || 4000;
const MODE = process.env.MOCK_EDUCORE_MODE || "static";

// Each demo student's one real, true department — independent of whatever
// department they type at login (that's just a self-reported display value;
// verification here, like a real EduCore, checks actual enrollment, not the
// claim). A studentId not listed here has no known enrollment anywhere, so
// it's denied for every department — no random luck for arbitrary logins.
const ROSTER = {
  "ad-student-1": "Computer Science",
  "ad-student-3": "Business",
};

async function pingPublicApi(studentId, department) {
  const hash = crypto.createHash("sha256").update(`${studentId}:${department}`).digest();
  const todoId = (hash.readUInt32BE(0) % 200) + 1;
  const response = await axios.get(`https://jsonplaceholder.typicode.com/todos/${todoId}`, {
    timeout: 5000,
  });
  return { todoId, completed: response.data.completed };
}

app.get("/enrollment/verify", async (req, res) => {
  const { studentId, department } = req.query;

  try {
    const verified = ROSTER[studentId] === department;

    if (MODE === "public-api") {
      const { todoId, completed } = await pingPublicApi(studentId, department);
      console.log(
        `[mock-educore:public-api] ${studentId}/${department} -> roster says "${ROSTER[studentId] || "no known enrollment"}" -> verified=${verified} ` +
          `(pinged jsonplaceholder todo #${todoId}, completed=${completed}, logged only — not used for the decision)`
      );
    } else {
      console.log(`[mock-educore:static] ${studentId}/${department} -> roster says "${ROSTER[studentId] || "no known enrollment"}" -> verified=${verified}`);
    }

    res.json({ verified });
  } catch (err) {
    console.error(`[mock-educore:${MODE}] error verifying, defaulting to false:`, err.message);
    res.json({ verified: false });
  }
});

app.listen(PORT, () => {
  console.log(`Mock EduCore listening on port ${PORT} (mode: ${MODE})`);
  console.log("Roster (each student's one real department):", ROSTER);
  console.log('Try: ad-student-3 ordering a "Business" item -> verified; ordering a "Computer Science" item -> denied.');
});
