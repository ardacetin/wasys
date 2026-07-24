const DEFAULT_PLATFORM_ADMIN = "demo@wasys.app";

export function platformAdminEmails() {
  return (process.env.PLATFORM_ADMIN_EMAILS || DEFAULT_PLATFORM_ADMIN)
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isPlatformAdmin(email?: string | null) {
  if (!email) return false;
  return platformAdminEmails().includes(email.toLowerCase());
}
