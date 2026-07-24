import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  let platformAdminEmail = process.env.PLATFORM_ADMIN_EMAILS
    ?.split(",")[0]
    ?.trim()
    ?.toLowerCase();
  const platformAdminPassword = process.env.PLATFORM_ADMIN_PASSWORD;

  if (!platformAdminEmail) {
    const existingOwner = await prisma.user.findFirst({
      where: { role: "OWNER" },
      select: { email: true },
      orderBy: { createdAt: "asc" },
    });
    platformAdminEmail = existingOwner?.email;
  }
  if (!platformAdminEmail) {
    throw new Error(
      "PLATFORM_ADMIN_EMAILS must be set when creating the platform admin for the first time",
    );
  }
  if (!platformAdminEmail.includes("@")) {
    throw new Error(
      `PLATFORM_ADMIN_EMAILS is not a valid email (got "${platformAdminEmail}"). Replace the placeholder in .env with your real address.`,
    );
  }
  if (platformAdminPassword && platformAdminPassword.length < 12) {
    throw new Error("PLATFORM_ADMIN_PASSWORD must contain at least 12 characters");
  }
  console.log(
    `[WASYS bootstrap] platform admin email: ${platformAdminEmail} (password ${platformAdminPassword ? "will be updated from .env" : "kept as-is"})`,
  );

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

  const existingAdmin = await prisma.user.findUnique({
    where: { email: platformAdminEmail },
    select: { passwordHash: true },
  });
  if (!existingAdmin && !platformAdminPassword) {
    throw new Error(
      "PLATFORM_ADMIN_PASSWORD must be set when creating the platform admin for the first time",
    );
  }
  const passwordHash = platformAdminPassword
    ? await hash(platformAdminPassword, 12)
    : existingAdmin.passwordHash;
  await prisma.user.upsert({
    where: { email: platformAdminEmail },
    update: {
      name: "WASYS Yönetici",
      passwordHash,
      role: "OWNER",
      organizationId: organization.id,
    },
    create: {
      email: platformAdminEmail,
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

  console.log("WASYS bootstrap complete: platform admin is ready");
}

main()
  .catch((error) => {
    console.error("WASYS bootstrap failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
