const request = require("supertest");
const express = require("express");

const mockPrismaClient = {
  category: {
    findMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  auditLog: { create: jest.fn() },
};

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

// Bypass real JWT verification; inject a fake user based on a test header
jest.mock("../src/middleware/auth", () => ({
  requireAuth: (req, res, next) => {
    req.user = {
      id: "user-1",
      role: req.headers["x-test-role"] || "STUDENT",
      adObjectId: "ad-1",
    };
    next();
  },
}));

const categoriesRouter = require("../src/routes/categories");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/categories", categoriesRouter);
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}

describe("GET /categories", () => {
  it("returns categories for an authenticated user", async () => {
    mockPrismaClient.category.findMany.mockResolvedValue([
      { id: "c1", name: "Computer Science", description: null },
    ]);

    const res = await request(buildApp()).get("/categories");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("Computer Science");
  });
});

describe("POST /categories", () => {
  it("allows STAFF to create a category", async () => {
    mockPrismaClient.category.create.mockResolvedValue({
      id: "c2",
      name: "Engineering",
      description: "Engineering dept gear",
    });

    const res = await request(buildApp())
      .post("/categories")
      .set("x-test-role", "STAFF")
      .send({ name: "Engineering", description: "Engineering dept gear" });

    expect(res.status).toBe(201);
    expect(mockPrismaClient.category.create).toHaveBeenCalledWith({
      data: { name: "Engineering", description: "Engineering dept gear" },
    });
  });

  it("rejects STUDENT from creating a category", async () => {
    const res = await request(buildApp())
      .post("/categories")
      .set("x-test-role", "STUDENT")
      .send({ name: "Nope" });

    expect(res.status).toBe(403);
    expect(mockPrismaClient.category.create).not.toHaveBeenCalled();
  });
});

describe("PUT /categories/:id", () => {
  it("allows ADMIN to rename a category", async () => {
    mockPrismaClient.category.findUnique.mockResolvedValue({ id: "c1", name: "Old" });
    mockPrismaClient.category.update.mockResolvedValue({ id: "c1", name: "New" });

    const res = await request(buildApp())
      .put("/categories/c1")
      .set("x-test-role", "ADMIN")
      .send({ name: "New" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("New");
  });

  it("rejects STAFF from editing a category", async () => {
    const res = await request(buildApp())
      .put("/categories/c1")
      .set("x-test-role", "STAFF")
      .send({ name: "New" });

    expect(res.status).toBe(403);
  });
});

describe("DELETE /categories/:id", () => {
  it("blocks deletion when products still reference the category", async () => {
    mockPrismaClient.category.findUnique.mockResolvedValue({ id: "c1", name: "Engineering" });
    mockPrismaClient.category.delete.mockRejectedValue({ code: "P2003" });

    const res = await request(buildApp()).delete("/categories/c1").set("x-test-role", "ADMIN");

    expect(res.status).toBe(409);
  });

  it("allows ADMIN to delete an unused category", async () => {
    mockPrismaClient.category.findUnique.mockResolvedValue({ id: "c1", name: "Engineering" });
    mockPrismaClient.category.delete.mockResolvedValue({});

    const res = await request(buildApp()).delete("/categories/c1").set("x-test-role", "ADMIN");

    expect(res.status).toBe(204);
  });
});