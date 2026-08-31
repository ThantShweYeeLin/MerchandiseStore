const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function recordAudit({ userId, action, entityType, entityId }) {
  return prisma.auditLog.create({
    data: { userId, action, entityType, entityId },
  });
}

module.exports = { recordAudit };
