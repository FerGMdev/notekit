import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const result = await prisma.user.deleteMany({ where: { id: "dev-user" } });
  console.log("deleted", result.count);
} finally {
  await prisma.$disconnect();
}
