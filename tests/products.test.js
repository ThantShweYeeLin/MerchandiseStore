const request = require("supertest");
const express = require("express");

const mockPrismaClient = {
  product: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  category: { findUnique: jest.fn() },
  auditLog: { create: jest.fn() },
};

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

jest.mock("../src/middleware/auth", () => ({
  requireAuth: (req, res, next) => {
    req.user = {
      id: "staff-1",
      role: req.headers["x-test-role"] || "STUDENT",
      adObjectId: "ad-staff-1",
    };
    next();
  },
}));

jest.mock("../src/services/aiDescription", () => ({
  generateProductDescription: jest.fn(),
}));

const { generateProductDescription } = require("../src/services/aiDescription");
const productsRouter = require("../src/routes/products");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/products", productsRouter);
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}

describe("POST /products", () => {
  it("creates a product with an AI-generated description", async () => {
    mockPrismaClient.category.findUnique.mockResolvedValue({ id: "cat-1", name: "Computer Science" });
    generateProductDescription.mockResolvedValue("A cozy CS-branded hoodie.");
    mockPrismaClient.product.create.mockResolvedValue({
      id: "p1",
      name: "CS Hoodie",
      description: "A cozy CS-branded hoodie.",
    });
    mockPrismaClient.auditLog.create.mockResolvedValue({});

    const res = await request(buildApp())
      .post("/products")
      .set("x-test-role", "STAFF")
      .send({ name: "CS Hoodie", slug: "cs-hoodie", price: 25, categoryId: "cat-1", stock: 10 });

    expect(res.status).toBe(201);
    expect(generateProductDescription).toHaveBeenCalledWith({
      name: "CS Hoodie",
      categoryName: "Computer Science",
    });
    expect(mockPrismaClient.auditLog.create).toHaveBeenCalled();
  });

  it("still creates the product if the AI API call fails", async () => {
    mockPrismaClient.category.findUnique.mockResolvedValue({ id: "cat-1", name: "Computer Science" });
    generateProductDescription.mockRejectedValue(new Error("AI API down"));
    mockPrismaClient.product.create.mockResolvedValue({ id: "p2", name: "CS Mug", description: null });
    mockPrismaClient.auditLog.create.mockResolvedValue({});

    const res = await request(buildApp())
      .post("/products")
      .set("x-test-role", "ADMIN")
      .send({ name: "CS Mug", slug: "cs-mug", price: 8, categoryId: "cat-1" });

    expect(res.status).toBe(201);
    expect(mockPrismaClient.product.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ description: null }) })
    );
  });

  it("rejects an invalid categoryId with 400", async () => {
    mockPrismaClient.category.findUnique.mockResolvedValue(null);

    const res = await request(buildApp())
      .post("/products")
      .set("x-test-role", "STAFF")
      .send({ name: "Ghost Item", slug: "ghost", price: 10, categoryId: "bad-id" });

    expect(res.status).toBe(400);
    expect(mockPrismaClient.product.create).not.toHaveBeenCalled();
  });

  it("rejects STUDENT from creating a product", async () => {
    const res = await request(buildApp())
      .post("/products")
      .set("x-test-role", "STUDENT")
      .send({ name: "Nope", slug: "nope", price: 1, categoryId: "cat-1" });

    expect(res.status).toBe(403);
  });
});

describe("GET /products/:id", () => {
  it("returns 404 for an unknown product", async () => {
    mockPrismaClient.product.findUnique.mockResolvedValue(null);

    const res = await request(buildApp()).get("/products/does-not-exist");

    expect(res.status).toBe(404);
  });
});