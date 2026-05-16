"use client";

import { PageShell, PublicNav, emptyStateClass } from "@/components/ui";

export default function TenantPublicEventsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <>
      <PublicNav />
      <PageShell>
        <div className={emptyStateClass}>
          <p>Unable to load approved activity right now.</p>
          <button
            type="button"
            onClick={() => reset()}
            className="mt-3 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted"
          >
            Try again
          </button>
        </div>
      </PageShell>
    </>
  );
}
