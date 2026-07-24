import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const organization = await prisma.organization.upsert({
    where: { slug: "wasys-demo" },
    update: { name: "WASYS Demo", plan: "PRO", maxUsers: 50 },
    create: {
      name: "WASYS Demo",
      slug: "wasys-demo",
      plan: "PRO",
      maxUsers: 50,
    },
  });

  const passwordHash = await hash("demo1234", 12);
  await prisma.user.upsert({
    where: { email: "demo@wasys.app" },
    update: {
      name: "WASYS Yönetici",
      passwordHash,
      role: "OWNER",
      organizationId: organization.id,
    },
    create: {
      email: "demo@wasys.app",
      name: "WASYS Yönetici",
      passwordHash,
      role: "OWNER",
      organizationId: organization.id,
    },
  });

  const existingChannel = await prisma.channel.findFirst({
    where: { organizationId: organization.id },
  });
  if (!existingChannel) {
    await prisma.channel.create({
      data: {
        organizationId: organization.id,
        name: "Ana WhatsApp",
        type: "WHATSAPP_QR",
        status: "DISCONNECTED",
        sessionId: `sess_${organization.id.slice(0, 8)}`,
      },
    });
  }

  const defaultTags = [
    { name: "Yeni Lead", color: "#128C7E" },
    { name: "Sipariş", color: "#25D366" },
    { name: "Destek", color: "#075E54" },
  ];
  for (const tag of defaultTags) {
    await prisma.tag.upsert({
      where: {
        organizationId_name: {
          organizationId: organization.id,
          name: tag.name,
        },
      },
      update: { color: tag.color },
      create: { ...tag, organizationId: organization.id },
    });
  }

  console.log("WASYS bootstrap complete: demo@wasys.app is ready");
}

main()
  .catch((error) => {
    console.error("WASYS bootstrap failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
