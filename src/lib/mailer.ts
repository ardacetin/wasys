import nodemailer from "nodemailer";

/**
 * SMTP ayarları .env üzerinden okunur:
 *   SMTP_HOST=smtp.hostinger.com
 *   SMTP_PORT=465
 *   SMTP_SECURE=true        (465 için true, 587 için false)
 *   SMTP_USER=no-reply@wasys.pro
 *   SMTP_PASS=...
 *   SMTP_FROM="WASYS <no-reply@wasys.pro>"   (opsiyonel, varsayılan SMTP_USER)
 */
export function mailerConfigured() {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim(),
  );
}

function transporter() {
  const port = Number(process.env.SMTP_PORT || 465);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE
      ? process.env.SMTP_SECURE === "true"
      : port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendMail(options: {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
}) {
  if (!mailerConfigured()) {
    console.warn("[WASYS mailer] SMTP yapılandırılmamış, e-posta atlandı:", options.subject);
    return { sent: false as const, reason: "SMTP yapılandırılmamış" };
  }

  try {
    const info = await transporter().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    return { sent: true as const, messageId: info.messageId };
  } catch (error) {
    console.error("[WASYS mailer] e-posta gönderilemedi", error);
    return {
      sent: false as const,
      reason: error instanceof Error ? error.message : "Bilinmeyen hata",
    };
  }
}
