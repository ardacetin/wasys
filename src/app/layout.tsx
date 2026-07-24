import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "WASYS — WhatsApp CRM",
    template: "%s | WASYS",
  },
  description:
    "WhatsApp mesajlarınızı ortak gelen kutusunda yönetin; ekibinizi, otomasyonları ve müşteri iletişimini tek platformda büyütün.",
  keywords: ["WhatsApp CRM", "ortak gelen kutusu", "müşteri yönetimi", "WhatsApp ekip yönetimi"],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr" className={`${manrope.variable} ${fraunces.variable} h-full`}>
      <body className="min-h-full antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
