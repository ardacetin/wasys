import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.PLATFORM_ADMIN_EMAILS?.split(",")[0]?.trim().toLowerCase();
  const adminPassword = process.env.PLATFORM_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword || adminPassword.length < 12) {
    throw new Error(
      "Seed için PLATFORM_ADMIN_EMAILS ve en az 12 karakterli PLATFORM_ADMIN_PASSWORD gerekli",
    );
  }

  await prisma.intentSuggestion.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.assignmentRule.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversationTag.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.channel.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.messageTemplate.deleteMany();
  await prisma.quickButton.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  const org = await prisma.organization.create({
    data: {
      name: "WASYS Demo",
      slug: "wasys-demo",
      plan: "STANDARD",
      maxUsers: 50,
    },
  });

  const passwordHash = await hash(adminPassword, 10);

  const owner = await prisma.user.create({
    data: {
      email: adminEmail,
      name: "Arda Yönetici",
      passwordHash,
      role: "OWNER",
      organizationId: org.id,
      phone: "+905551112233",
    },
  });

  const agent = await prisma.user.create({
    data: {
      email: process.env.SEED_AGENT_EMAIL ?? "agent@wasys.local",
      name: "Selin Temsilci",
      passwordHash,
      role: "AGENT",
      organizationId: org.id,
      phone: "+905554445566",
    },
  });

  const channel = await prisma.channel.create({
    data: {
      organizationId: org.id,
      name: "Ana WhatsApp",
      type: "WHATSAPP_QR",
      status: "DISCONNECTED",
      sessionId: `sess_${org.id.slice(0, 8)}`,
    },
  });

  const tags = await Promise.all([
    prisma.tag.create({ data: { organizationId: org.id, name: "Yeni Lead", color: "#0F766E" } }),
    prisma.tag.create({ data: { organizationId: org.id, name: "Sipariş", color: "#C2410C" } }),
    prisma.tag.create({ data: { organizationId: org.id, name: "Destek", color: "#1D4ED8" } }),
  ]);

  await prisma.messageTemplate.createMany({
    data: [
      {
        organizationId: org.id,
        title: "Karşılama",
        body: "Merhaba! WASYS destek ekibine hoş geldiniz. Size nasıl yardımcı olabiliriz?",
        shortcut: "/merhaba",
      },
      {
        organizationId: org.id,
        title: "Sipariş durumu",
        body: "Siparişinizi kontrol ediyoruz, kısa süre içinde dönüş yapacağız.",
        shortcut: "/siparis",
      },
      {
        organizationId: org.id,
        title: "Kapanış",
        body: "Başka bir konuda yardımcı olmamı ister misiniz? İyi günler dileriz.",
        shortcut: "/kapanis",
      },
    ],
  });

  await prisma.quickButton.createMany({
    data: [
      { organizationId: org.id, label: "Merhaba", body: "Merhaba! Size nasıl yardımcı olabilirim?", sortOrder: 1 },
      { organizationId: org.id, label: "Teşekkürler", body: "Teşekkür ederiz, iyi günler!", sortOrder: 2 },
      { organizationId: org.id, label: "Bekleyin", body: "Bir saniye, konuyu kontrol ediyorum.", sortOrder: 3 },
    ],
  });

  const contacts = await Promise.all([
    prisma.contact.create({
      data: {
        organizationId: org.id,
        name: "Ayşe Yılmaz",
        phone: "905321112233",
        email: "ayse@ornek.com",
      },
    }),
    prisma.contact.create({
      data: {
        organizationId: org.id,
        name: "Mehmet Kaya",
        phone: "905339998877",
        email: "mehmet@ornek.com",
      },
    }),
    prisma.contact.create({
      data: {
        organizationId: org.id,
        name: "Zeynep Demir",
        phone: "905551234567",
      },
    }),
  ]);

  const conv1 = await prisma.conversation.create({
    data: {
      organizationId: org.id,
      channelId: channel.id,
      contactId: contacts[0].id,
      assignedToId: agent.id,
      lastMessageAt: new Date(),
      lastMessagePreview: "Siparişim ne zaman gelir?",
      unreadCount: 1,
      tags: { create: [{ tagId: tags[1].id }] },
      messages: {
        create: [
          {
            direction: "INBOUND",
            type: "TEXT",
            status: "DELIVERED",
            body: "Merhaba, dün verdiğim sipariş hakkında bilgi alabilir miyim?",
            createdAt: new Date(Date.now() - 1000 * 60 * 45),
          },
          {
            direction: "OUTBOUND",
            type: "TEXT",
            status: "READ",
            body: "Tabii, sipariş numaranızı paylaşır mısınız?",
            sentById: agent.id,
            createdAt: new Date(Date.now() - 1000 * 60 * 40),
          },
          {
            direction: "INBOUND",
            type: "TEXT",
            status: "DELIVERED",
            body: "Siparişim ne zaman gelir?",
            createdAt: new Date(Date.now() - 1000 * 60 * 5),
          },
        ],
      },
    },
  });

  await prisma.conversation.create({
    data: {
      organizationId: org.id,
      channelId: channel.id,
      contactId: contacts[1].id,
      assignedToId: owner.id,
      lastMessageAt: new Date(Date.now() - 1000 * 60 * 120),
      lastMessagePreview: "Fiyat listesi isterim",
      unreadCount: 0,
      tags: { create: [{ tagId: tags[0].id }] },
      messages: {
        create: [
          {
            direction: "INBOUND",
            type: "TEXT",
            status: "READ",
            body: "Fiyat listesi isterim",
            createdAt: new Date(Date.now() - 1000 * 60 * 120),
          },
          {
            direction: "OUTBOUND",
            type: "TEXT",
            status: "DELIVERED",
            body: "Tabii, hemen iletiyorum.",
            sentById: owner.id,
            createdAt: new Date(Date.now() - 1000 * 60 * 115),
          },
        ],
      },
    },
  });

  await prisma.conversation.create({
    data: {
      organizationId: org.id,
      channelId: channel.id,
      contactId: contacts[2].id,
      lastMessageAt: new Date(Date.now() - 1000 * 60 * 20),
      lastMessagePreview: "Uygulama açılmıyor",
      unreadCount: 2,
      tags: { create: [{ tagId: tags[2].id }] },
      messages: {
        create: [
          {
            direction: "INBOUND",
            type: "TEXT",
            status: "DELIVERED",
            body: "Merhaba, uygulama açılmıyor.",
            createdAt: new Date(Date.now() - 1000 * 60 * 25),
          },
          {
            direction: "INBOUND",
            type: "TEXT",
            status: "DELIVERED",
            body: "Uygulama açılmıyor",
            createdAt: new Date(Date.now() - 1000 * 60 * 20),
          },
        ],
      },
    },
  });

  await prisma.assignmentRule.createMany({
    data: [
      {
        organizationId: org.id,
        name: "Sipariş → Selin",
        matchType: "KEYWORD",
        matchValue: "sipariş",
        assignToId: agent.id,
        priority: 10,
      },
      {
        organizationId: org.id,
        name: "Yeni sohbet → round-robin",
        matchType: "UNASSIGNED",
        matchValue: null,
        assignToId: null,
        priority: 200,
      },
    ],
  });

  console.log("Seed complete");
  console.log("Platform admin and local agent created from environment configuration");
  console.log("Conversations:", conv1.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
