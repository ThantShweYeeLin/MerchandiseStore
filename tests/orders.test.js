const request = require("supertest");
const express = require("express");

const mockPrismaClient = {
  product: { findMany: jest.fn() },
  order: { create: jest.fn(), update: jest.fn() },
  peerVerificationLog: { create: jest.fn() },
  auditLog: { create: jest.fn() },
};

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

jest.mock("../src/middleware/auth", () => ({
  requireAuth: (req, res, next) => {
    req.user = {
      id: "student-1",
      role: req.headers["x-test-role"] || "STUDENT",
      adObjectId: "ad-student-1",
    };
    next();
  },
}));

jest.mock("../src/services/eduCoreClient", () => ({
  verifyEnrollment: jest.fn(),
}));

const { verifyEnrollment } = require("../src/services/eduCoreClient");
const ordersRouter = require("../src/routes/orders");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/orders", ordersRouter);
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}

const product = { id: "p1", price: 100, category: { name: "Computer Science" } };

function mockOrderPersistence(orderId) {
  mockPrismaClient.order.create.mockResolvedValue({
    id: orderId,
    items: [{ productId: "p1", quantity: 1, unitPrice: 100, product }],
  });
  mockPrismaClient.peerVerificationLog.create.mockResolvedValue({});
  mockPrismaClient.order.update.mockImplementation(({ data }) =>
    Promise.resolve({ id: orderId, ...data, items: [], peerVerificationLogs: [] })
  );
  mockPrismaClient.auditLog.create.mockResolvedValue({});
}

describe("POST /orders", () => {
  it("applies a discount when EduCore verifies enrollment", async () => {
    mockPrismaClient.product.findMany.mockResolvedValue([product]);
    mockOrderPersistence("o1");
    verifyEnrollment.mockResolvedValue({ verified: true, raw: { verified: true } });

    const res = await request(buildApp())
      .post("/orders")
      .set("x-test-role", "STUDENT")
      .send({ items: [{ productId: "p1", quantity: 1 }] });

    expect(res.status).toBe(201);
    expect(verifyEnrollment).toHaveBeenCalledWith({
      studentId: "ad-student-1",
      department: "Computer Science",
    });
    expect(res.body.discountApplied).toBe(true);
    expect(res.body.totalAmount).toBeCloseTo(85); // 15% off 100
  });

  it("keeps full price when EduCore denies enrollment", async () => {
    mockPrismaClient.product.findMany.mockResolvedValue([product]);
    mockOrderPersistence("o2");
    verifyEnrollment.mockResolvedValue({ verified: false, raw: { verified: false } });

    const res = await request(buildApp())
      .post("/orders")
      .set("x-test-role", "STUDENT")
      .send({ items: [{ productId: "p1", quantity: 1 }] });

    expect(res.body.discountApplied).toBe(false);
    expect(res.body.totalAmount).toBe(100);
  });

  it("fails closed (no discount) if EduCore is unreachable", async () => {
    mockPrismaClient.product.findMany.mockResolvedValue([product]);
    mockOrderPersistence("o3");
    verifyEnrollment.mockResolvedValue({ verified: false, raw: { error: "timeout" } });

    const res = await request(buildApp())
      .post("/orders")
      .set("x-test-role", "STUDENT")
      .send({ items: [{ productId: "p1", quantity: 1 }] });

    expect(res.body.discountApplied).toBe(false);
  });

  it("rejects an empty items array", async () => {
    const res = await request(buildApp())
      .post("/orders")
      .set("x-test-role", "STUDENT")
      .send({ items: [] });

    expect(res.status).toBe(400);
    expect(mockPrismaClient.order.create).not.toHaveBeenCalled();
  });

  it("rejects STAFF from placing an order", async () => {
    const res = await request(buildApp())
      .post("/orders")
      .set("x-test-role", "STAFF")
      .send({ items: [{ productId: "p1", quantity: 1 }] });

    expect(res.status).toBe(403);
  });
});