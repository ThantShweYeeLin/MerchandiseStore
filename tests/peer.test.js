const request = require("supertest");
const express = require("express");

const mockPrismaClient = {
  user: { findUnique: jest.fn() },
  order: { findMany: jest.fn() },
};

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

jest.mock("../src/config/keyvault", () => ({
  getSecret: jest.fn(() => "expected-educore-key"),
}));

const peerRouter = require("../src/routes/peer");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/peer", peerRouter);
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}

describe("GET /peer/students/:studentId/orders", () => {
  it("rejects requests without a valid x-api-key", async () => {
    const res = await request(buildApp()).get("/peer/students/ad-1/orders");
    expect(res.status).toBe(401);
    expect(mockPrismaClient.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown student", async () => {
    mockPrismaClient.user.findUnique.mockResolvedValue(null);

    const res = await request(buildApp())
      .get("/peer/students/unknown-ad-id/orders")
      .set("x-api-key", "expected-educore-key");

    expect(res.status).toBe(404);
  });

  it("returns a summary with no payment details for a known student", async () => {
    mockPrismaClient.user.findUnique.mockResolvedValue({ id: "u1", adObjectId: "ad-1" });
    mockPrismaClient.order.findMany.mockResolvedValue([
      {
        totalAmount: 85,
        discountApplied: true,
        items: [{ product: { category: { name: "Computer Science" } } }],
        peerVerificationLogs: [{ department: "Computer Science", verified: true }],
      },
      {
        totalAmount: 40,
        discountApplied: false,
        items: [{ product: { category: { name: "Business" } } }],
        peerVerificationLogs: [{ department: "Business", verified: false }],
      },
    ]);

    const res = await request(buildApp())
      .get("/peer/students/ad-1/orders")
      .set("x-api-key", "expected-educore-key");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      studentId: "ad-1",
      orderCount: 2,
      totalSpend: 125,
      discountUsageByDepartment: { "Computer Science": 1 },
    });
  });

  it("only counts departments actually verified within a mixed order", async () => {
    mockPrismaClient.user.findUnique.mockResolvedValue({ id: "u1", adObjectId: "ad-1" });
    mockPrismaClient.order.findMany.mockResolvedValue([
      {
        totalAmount: 185,
        discountApplied: true, // true because CS verified, even though Engineering didn't
        items: [
          { product: { category: { name: "Computer Science" } } },
          { product: { category: { name: "Engineering" } } },
        ],
        peerVerificationLogs: [
          { department: "Computer Science", verified: true },
          { department: "Engineering", verified: false },
        ],
      },
    ]);

    const res = await request(buildApp())
      .get("/peer/students/ad-1/orders")
      .set("x-api-key", "expected-educore-key");

    expect(res.body.discountUsageByDepartment).toEqual({ "Computer Science": 1 });
    expect(res.body.discountUsageByDepartment.Engineering).toBeUndefined();
  });
});