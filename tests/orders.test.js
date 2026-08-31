const request = require("supertest");
const express = require("express");

const mockPrismaClient = {
  product: { findMany: jest.fn() },
  order: { create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
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
      department: req.headers["x-test-department"] || null,
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

  it("discounts only the items from a verified department, not the whole order", async () => {
    const csProduct = { id: "p1", price: 100, category: { name: "Computer Science" } };
    const engProduct = { id: "p2", price: 100, category: { name: "Engineering" } };
    mockPrismaClient.product.findMany.mockResolvedValue([csProduct, engProduct]);

    mockPrismaClient.order.create.mockResolvedValue({
      id: "o4",
      items: [
        { productId: "p1", quantity: 1, unitPrice: 100, product: csProduct },
        { productId: "p2", quantity: 1, unitPrice: 100, product: engProduct },
      ],
    });
    mockPrismaClient.peerVerificationLog.create.mockResolvedValue({});
    mockPrismaClient.order.update.mockImplementation(({ data }) =>
      Promise.resolve({ id: "o4", ...data, items: [], peerVerificationLogs: [] })
    );
    mockPrismaClient.auditLog.create.mockResolvedValue({});

    // Only Computer Science verifies; Engineering does not.
    verifyEnrollment.mockImplementation(({ department }) =>
      Promise.resolve({
        verified: department === "Computer Science",
        raw: { department },
      })
    );

    const res = await request(buildApp())
      .post("/orders")
      .set("x-test-role", "STUDENT")
      .send({
        items: [
          { productId: "p1", quantity: 1 },
          { productId: "p2", quantity: 1 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.discountApplied).toBe(true);
    // 85 (CS, discounted) + 100 (Engineering, full price) = 185
    expect(res.body.totalAmount).toBeCloseTo(185);
  });
});

describe("GET /orders", () => {
  it("scopes results to the staff member's own department", async () => {
    mockPrismaClient.order.findMany.mockResolvedValue([{ id: "o1" }]);

    const res = await request(buildApp())
      .get("/orders")
      .set("x-test-role", "STAFF")
      .set("x-test-department", "Computer Science");

    expect(res.status).toBe(200);
    expect(mockPrismaClient.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          items: {
            some: { product: { category: { name: "Computer Science" } } },
          },
        },
      })
    );
  });

  it("lets ADMIN see orders across every department", async () => {
    mockPrismaClient.order.findMany.mockResolvedValue([]);

    const res = await request(buildApp()).get("/orders").set("x-test-role", "ADMIN");

    expect(res.status).toBe(200);
    expect(mockPrismaClient.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
  });

  it("rejects STUDENT from listing all orders", async () => {
    const res = await request(buildApp()).get("/orders").set("x-test-role", "STUDENT");

    expect(res.status).toBe(403);
  });
});