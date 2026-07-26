/** Kiracı (organization) yönetimi — OWNER ve ADMIN. */
export function isOrgAdmin(role: string | null | undefined) {
  return role === "OWNER" || role === "ADMIN";
}
