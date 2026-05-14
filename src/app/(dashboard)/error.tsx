"use client";

function authzMessage(error: Error) {
  const message = error.message.toLowerCase();

  if (message.includes("unauthenticated")) {
    return "Sign in to access this area.";
  }

  if (message.includes("tenant_not_found") || message.includes("tenant not found")) {
    return "We could not find the tenant for this dashboard.";
  }

  if (
    message.includes("user_not_linked_to_tenant") ||
    message.includes("not linked")
  ) {
    return "Your signed-in account is not linked to this tenant.";
  }

  if (message.includes("insufficient_role") || message.includes("permission")) {
    return "Your role does not allow access to this area.";
  }

  return "We could not load this private area safely.";
}

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-rose-950">
      <p className="text-sm font-semibold uppercase tracking-wide text-rose-700">
        Access issue
      </p>
      <h1 className="mt-2 text-xl font-semibold">Dashboard unavailable</h1>
      <p className="mt-2 max-w-2xl text-sm text-rose-900">
        {authzMessage(error)}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-md border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-950 shadow-sm hover:bg-rose-100"
      >
        Try again
      </button>
    </section>
  );
}
