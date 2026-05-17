"use client";

import Link from "next/link";
import { useTenantLink } from "@/lib/use-tenant-link";

export function TenantAwareTopbarLinks({
  selectedTenantSlug,
}: {
  selectedTenantSlug?: string;
}) {
  const linkFor = useTenantLink(selectedTenantSlug);

  return (
    <>
      <Link
        href={linkFor("/calendar")}
        className="hidden rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted sm:inline-flex"
      >
        Public calendar
      </Link>
      <Link
        href={linkFor("/book")}
        className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90"
      >
        New request
      </Link>
    </>
  );
}
