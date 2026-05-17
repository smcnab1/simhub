function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function displayNameFromUser(user?: {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  metadata?: Record<string, unknown>;
} | null) {
  const explicitName = normalizeString(user?.name ?? user?.metadata?.name);
  if (explicitName) return explicitName;

  const firstName = normalizeString(user?.firstName ?? user?.first_name ?? user?.metadata?.firstName);
  const lastName = normalizeString(user?.lastName ?? user?.last_name ?? user?.metadata?.lastName);
  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  return fullName || normalizeString(user?.email);
}
