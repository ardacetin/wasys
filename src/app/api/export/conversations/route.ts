import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  buildContactsExcel,
  buildMessagesExcel,
  directionLabel,
  formatExportDate,
  messageBodyLabel,
} from "@/lib/excel-export";

const MODES = ["contacts", "messages"] as const;
type ExportMode = (typeof MODES)[number];

const MAX_MESSAGE_ROWS = 50_000;

function parseRange(params: URLSearchParams) {
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  let from = params.get("from") ? new Date(params.get("from")!) : defaultFrom;
  let to = params.get("to") ? new Date(params.get("to")!) : now;
  if (Number.isNaN(from.getTime())) from = defaultFrom;
  if (Number.isNaN(to.getTime())) to = now;
  if (from > to) [from, to] = [to, from];
  // Inclusive end-of-day feel when client sends date-only midnight
  return { from, to };
}

function fileStamp(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = session.user.organizationId;
  const params = request.nextUrl.searchParams;
  const modeParam = params.get("mode") ?? "contacts";
  const mode: ExportMode = MODES.includes(modeParam as ExportMode)
    ? (modeParam as ExportMode)
    : "contacts";
  const { from, to } = parseRange(params);

  if (mode === "contacts") {
    const contacts = await prisma.contact.findMany({
      where: {
        organizationId: orgId,
        conversations: {
          some: {
            messages: {
              some: {
                createdAt: { gte: from, lte: to },
              },
            },
          },
        },
      },
      select: { name: true, phone: true },
      orderBy: [{ name: "asc" }, { phone: "asc" }],
    });

    const buffer = await buildContactsExcel(
      contacts.map((c) => ({
        name: c.name?.trim() || c.phone,
        phone: c.phone,
      })),
    );

    const filename = `wasys-kisiler-${fileStamp(from)}_${fileStamp(to)}.xlsx`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const messages = await prisma.message.findMany({
    where: {
      createdAt: { gte: from, lte: to },
      conversation: { organizationId: orgId },
    },
    orderBy: { createdAt: "asc" },
    take: MAX_MESSAGE_ROWS,
    select: {
      direction: true,
      type: true,
      body: true,
      mediaUrl: true,
      createdAt: true,
      conversation: {
        select: {
          assignedTo: { select: { name: true } },
          channel: { select: { name: true } },
          contact: { select: { name: true, phone: true } },
        },
      },
    },
  });

  const buffer = await buildMessagesExcel(
    messages.map((m) => {
      const contact = m.conversation.contact;
      return {
        name: contact.name?.trim() || contact.phone,
        phone: contact.phone,
        direction: directionLabel(m.direction),
        type: m.type,
        body: messageBodyLabel(m),
        sentAt: formatExportDate(m.createdAt),
        channel: m.conversation.channel.name,
        assignedTo: m.conversation.assignedTo?.name ?? "",
      };
    }),
  );

  const filename = `wasys-konusmalar-${fileStamp(from)}_${fileStamp(to)}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
