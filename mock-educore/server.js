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
// Run: node mock-educore/server.js
// Then point the real app at it: EDUCORE_BASE_URL=http://localhost:4000

const express = require("express"); // resolves from the project root's node_modules

const app = express();
const PORT = process.env.MOCK_EDUCORE_PORT || 4000;

// Hardcoded roster: adjust to match whatever test student/department you
// use when placing an order against this mock.
const ENROLLED = new Set([
  "ad-student-1:Computer Science",
]);

app.get("/enrollment/verify", (req, res) => {
  const { studentId, department } = req.query;
  const verified = ENROLLED.has(`${studentId}:${department}`);

  console.log(`[mock-educore] verify studentId=${studentId} department=${department} -> ${verified}`);

  res.json({ verified });
});

app.listen(PORT, () => {
  console.log(`Mock EduCore listening on port ${PORT}`);
  console.log(`Enrolled for testing: ${[...ENROLLED].join(", ")}`);
});
