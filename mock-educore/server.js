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
//   "public-api" — derives the verified/not-verified answer from a real
//     call to a public API (JSONPlaceholder) instead of the hardcoded
//     roster, purely so a live demo shows a genuine outbound network call
//     instead of an obviously-fake local lookup. The public API's data has
//     no real connection to enrollment — this is a demo aid, not a second
//     real integration. The actual EduCore contract this stands in for is
//     unchanged either way (see docs/educore-contract.md).
//
// Run: node mock-educore/server.js
// Then point the real app at it: EDUCORE_BASE_URL=http://localhost:4000

const crypto = require("crypto");
const express = require("express"); // resolves from the project root's node_modules
const axios = require("axios");

const app = express();
const PORT = process.env.MOCK_EDUCORE_PORT || 4000;
const MODE = process.env.MOCK_EDUCORE_MODE || "static";

// Hardcoded roster for "static" mode: adjust to match whatever test
// student/department you use when placing an order against this mock.
const ENROLLED = new Set(["ad-student-1:Computer Science"]);

// "public-api" mode: hash (studentId, department) to one of JSONPlaceholder's
// 200 fixed todos and use its `completed` field as the verified result.
// JSONPlaceholder's data is static test fixture data, so this is stable —
// two demo-friendly pairs already checked and documented below.
//   ad-student-3 / Business          -> verified: true
//   ad-student-1 / Computer Science  -> verified: false
async function verifyViaPublicApi(studentId, department) {
  const hash = crypto.createHash("sha256").update(`${studentId}:${department}`).digest();
  const todoId = (hash.readUInt32BE(0) % 200) + 1;

  const response = await axios.get(`https://jsonplaceholder.typicode.com/todos/${todoId}`, {
    timeout: 5000,
  });

  console.log(`[mock-educore:public-api] ${studentId}/${department} -> todo #${todoId} -> completed=${response.data.completed}`);
  return Boolean(response.data.completed);
}

app.get("/enrollment/verify", async (req, res) => {
  const { studentId, department } = req.query;

  try {
    const verified =
      MODE === "public-api"
        ? await verifyViaPublicApi(studentId, department)
        : ENROLLED.has(`${studentId}:${department}`);

    console.log(`[mock-educore:${MODE}] verify studentId=${studentId} department=${department} -> ${verified}`);
    res.json({ verified });
  } catch (err) {
    console.error(`[mock-educore:${MODE}] error verifying, defaulting to false:`, err.message);
    res.json({ verified: false });
  }
});

app.listen(PORT, () => {
  console.log(`Mock EduCore listening on port ${PORT} (mode: ${MODE})`);
  if (MODE === "public-api") {
    console.log("Demo-reliable pairs: ad-student-3/Business -> enrolled, ad-student-1/Computer Science -> not enrolled");
  } else {
    console.log(`Enrolled for testing: ${[...ENROLLED].join(", ")}`);
  }
});
