import ExcelJS from "exceljs";

export type ContactExportRow = {
  name: string;
  phone: string;
};

export type MessageExportRow = {
  name: string;
  phone: string;
  direction: string;
  type: string;
  body: string;
  sentAt: string;
  channel: string;
  assignedTo: string;
};

export async function workbookToBuffer(workbook: ExcelJS.Workbook) {
  const raw = await workbook.xlsx.writeBuffer();
  return Buffer.from(raw);
}

export async function buildContactsExcel(rows: ContactExportRow[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "WASYS";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Kişiler");
  sheet.columns = [
    { header: "Ad Soyad", key: "name", width: 32 },
    { header: "Numara", key: "phone", width: 22 },
  ];
  styleHeader(sheet);
  for (const row of rows) sheet.addRow(row);

  return workbookToBuffer(workbook);
}

export async function buildMessagesExcel(rows: MessageExportRow[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "WASYS";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Konuşmalar");
  sheet.columns = [
    { header: "Ad Soyad", key: "name", width: 28 },
    { header: "Numara", key: "phone", width: 18 },
    { header: "Yön", key: "direction", width: 12 },
    { header: "Tür", key: "type", width: 12 },
    { header: "Mesaj", key: "body", width: 60 },
    { header: "Tarih", key: "sentAt", width: 20 },
    { header: "Kanal", key: "channel", width: 18 },
    { header: "Atanan", key: "assignedTo", width: 22 },
  ];
  styleHeader(sheet);
  for (const row of rows) sheet.addRow(row);

  return workbookToBuffer(workbook);
}

function styleHeader(sheet: ExcelJS.Worksheet) {
  const row = sheet.getRow(1);
  row.font = { bold: true };
  row.commit();
}

export function formatExportDate(date: Date) {
  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function messageBodyLabel(message: {
  type: string;
  body: string | null;
  mediaUrl: string | null;
}) {
  if (message.body?.trim()) return message.body.trim();
  switch (message.type) {
    case "AUDIO":
      return "[Sesli mesaj]";
    case "IMAGE":
      return "[Görsel]";
    case "VIDEO":
      return "[Video]";
    case "DOCUMENT":
      return "[Dosya]";
    case "TEMPLATE":
      return "[Şablon]";
    default:
      return message.mediaUrl ? "[Medya]" : "";
  }
}

export function directionLabel(direction: string) {
  return direction === "INBOUND" ? "Gelen" : "Giden";
}
