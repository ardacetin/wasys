import { redirect } from "next/navigation";

/** Eski yol — etiket + şablon ayarlarına yönlendir. */
export default function TemplatesRedirectPage() {
  redirect("/settings/library#sablonlar");
}
