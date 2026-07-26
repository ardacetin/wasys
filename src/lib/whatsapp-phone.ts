/** WhatsApp’a gönderim için geçerli telefon (rakam string). */
export function normalizeWhatsAppPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;

  // LID / yanlış kayıt (15+ hane)
  if (digits.length > 13) return null;

  // TR: 5xx xxx xx xx → 905xx...
  if (digits.length === 10 && digits.startsWith("5")) {
    digits = `90${digits}`;
  }

  if (digits.length < 8 || digits.length > 13) return null;
  return digits;
}

export function explainInvalidSendPhone(raw: string | null | undefined): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length > 13) {
    return "Bu kişinin kayıtlı numarası WhatsApp gizli ID — gerçek telefon yok. CRM’de numarayı düzeltin veya kişinin size yeni mesaj atmasını bekleyin.";
  }
  if (!digits || digits.length < 8) {
    return "Geçerli bir telefon numarası yok. CRM’den numarayı ekleyin.";
  }
  return "Telefon numarası WhatsApp gönderimi için geçersiz.";
}
