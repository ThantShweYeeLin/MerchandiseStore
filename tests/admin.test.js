const request = require("supertest");
const express = require("express");

const mockPrismaClient = {
  auditLog: { findMany: jest.fn(), create: jest.fn() },
  user: { findUnique: jest.fn(), update: jest.fn() },
};

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

jest.mock("../src/middleware/auth", () => ({
  requireAuth: (req, res, next) => {
    req.user = {
      id: "admin-1",
      role: req.headers["x-test-role"] || "STUDENT",
      adObjectId: "ad-admin-1",
    };
    next();
  },
}));

jest.mock("../src/config/keyvault", () => ({
  rotateSecret: jest.fn(),
}));

const { rotateSecret } = require("../src/config/keyvault");
const adminRouter = require("../src/routes/admin");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/admin", adminRouter);
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}

describe("GET /admin/audit-log", () => {
  it("allows ADMIN to view the audit trail", async () => {
    mockPrismaClient.auditLog.findMany.mockResolvedValue([{ id: "log1", action: "PRODUCT_CREATE" }]);

    const res = await request(buildApp()).get("/admin/audit-log").set("x-test-role", "ADMIN");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("rejects STAFF from viewing the audit trail", async () => {
    const res = await request(buildApp()).get("/admin/audit-log").set("x-test-role", "STAFF");

    expect(res.status).toBe(403);
  });
});

describe("PATCH /admin/users/:id/role", () => {
  it("allows ADMIN to change a user's role", async () => {
    mockPrismaClient.user.findUnique.mockResolvedValue({ id: "u1", role: "STUDENT" });
    mockPrismaClient.user.update.mockResolvedValue({ id: "u1", role: "STAFF" });

    const res = await request(buildApp())
      .patch("/admin/users/u1/role")
      .set("x-test-role", "ADMIN")
      .send({ role: "STAFF" });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe("STAFF");
  });

  it("rejects an invalid role value", async () => {
    const res = await request(buildApp())
      .patch("/admin/users/u1/role")
      .set("x-test-role", "ADMIN")
      .send({ role: "SUPERUSER" });

    expect(res.status).toBe(400);
  });

  it("rejects non-ADMIN callers", async () => {
    const res = await request(buildApp())
      .patch("/admin/users/u1/role")
      .set("x-test-role", "STAFF")
      .send({ role: "STAFF" });

    expect(res.status).toBe(403);
  });
});

describe("POST /admin/educore-inbound-key/rotate", () => {
  it("rotates the key and returns it once", async () => {
    rotateSecret.mockResolvedValue("new-key-value");

    const res = await request(buildApp())
      .post("/admin/educore-inbound-key/rotate")
      .set("x-test-role", "ADMIN");

    expect(res.status).toBe(200);
    expect(res.body.rotated).toBe(true);
    expect(res.body.newKey).toBeTruthy();
    expect(rotateSecret).toHaveBeenCalledWith("EDUCORE-INBOUND-KEY", expect.any(String));
  });

  it("rejects non-ADMIN callers", async () => {
    const res = await request(buildApp())
      .post("/admin/educore-inbound-key/rotate")
      .set("x-test-role", "STAFF");

    expect(res.status).toBe(403);
  });
});
