import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const demoUser = {
  username: process.env.TEST_USER_USERNAME ?? "demo_user",
  email: process.env.TEST_USER_EMAIL ?? "demo@example.com",
  password: process.env.TEST_USER_PASSWORD ?? "DemoUser123!",
  role: "USER" as const
};

const demoAdmin = {
  username: process.env.TEST_ADMIN_USERNAME ?? "admin",
  email: process.env.TEST_ADMIN_EMAIL ?? "admin@example.com",
  password: process.env.TEST_ADMIN_PASSWORD ?? "AdminUser123!",
  role: "ADMIN" as const
};

async function main(): Promise<void> {
  const userPasswordHash = await bcrypt.hash(demoUser.password, 12);
  const adminPasswordHash = await bcrypt.hash(demoAdmin.password, 12);

  await prisma.user.upsert({
    where: { email: demoUser.email },
    create: {
      username: demoUser.username,
      email: demoUser.email,
      passwordHash: userPasswordHash,
      role: demoUser.role
    },
    update: {
      username: demoUser.username,
      passwordHash: userPasswordHash,
      role: demoUser.role
    }
  });

  await prisma.user.upsert({
    where: { email: demoAdmin.email },
    create: {
      username: demoAdmin.username,
      email: demoAdmin.email,
      passwordHash: adminPasswordHash,
      role: demoAdmin.role
    },
    update: {
      username: demoAdmin.username,
      passwordHash: adminPasswordHash,
      role: demoAdmin.role
    }
  });

  console.log("Seeded test accounts:");
  console.log(`- user:  ${demoUser.email} / ${demoUser.password}`);
  console.log(`- admin: ${demoAdmin.email} / ${demoAdmin.password}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error("Seed failed", error);
    await prisma.$disconnect();
    process.exit(1);
  });
