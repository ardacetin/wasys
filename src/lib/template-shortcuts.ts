/**
 * Hazır mesaj kısayol yardımcıları (inbox autocomplete + Enter genişletme).
 */

export function normalizeShortcut(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLocaleLowerCase("tr-TR");
  if (!trimmed) return null;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function shortcutMatchesQuery(
  shortcut: string | null | undefined,
  query: string,
): boolean {
  const sc = normalizeShortcut(shortcut);
  if (!sc) return false;
  const q = normalizeShortcut(query);
  if (!q) return false;
  return sc === q || sc.startsWith(q);
}

export type TemplateLike = {
  id: string;
  title: string;
  body: string;
  shortcut: string | null;
};

/** Taslak `/` ile başlıyorsa eşleşen şablonları döner (kısayol veya başlık). */
export function filterTemplatesBySlashQuery<T extends TemplateLike>(
  templates: T[],
  draft: string,
): T[] {
  const text = draft.trim();
  if (!text.startsWith("/")) return [];

  const qNorm = normalizeShortcut(text)!;
  const bare = qNorm.slice(1);

  // Sadece "/" → tüm şablonlar (otomatik liste)
  if (!bare) return templates;

  return templates.filter((t) => {
    if (shortcutMatchesQuery(t.shortcut, text)) return true;
    const title = t.title.toLocaleLowerCase("tr-TR");
    return title.includes(bare);
  });
}

/** Enter ile genişletme: yalnızca tam kısayol eşleşmesi. */
export function findExactShortcutTemplate<T extends TemplateLike>(
  templates: T[],
  draft: string,
): T | null {
  const text = draft.trim();
  if (!text.startsWith("/")) return null;
  const want = normalizeShortcut(text);
  if (!want) return null;
  return (
    templates.find((t) => normalizeShortcut(t.shortcut) === want) ?? null
  );
}
