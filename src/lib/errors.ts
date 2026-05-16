export function friendlyErrorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const message = raw
    .replace(/^Uncaught Error:\s*/i, "")
    .replace(/^Error:\s*/i, "")
    .trim();
  const lower = message.toLowerCase();

  if (!message) return fallback;
  if (lower.includes("unauthenticated")) return "Please sign in again, then retry.";
  if (lower.includes("insufficient_role") || lower.includes("permission")) {
    return "Your account does not have permission to do that.";
  }
  if (lower.includes("user_not_linked_to_tenant") || lower.includes("not linked")) {
    return "Your account is not linked to this workspace.";
  }
  if (lower.includes("tenant_not_found")) return "We could not find this workspace.";

  return message;
}
