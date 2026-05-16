import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { APP_NAME } from "@/lib/config";

export function TenantNotFound({
  tenantSlug,
  host,
}: {
  tenantSlug?: string;
  host?: string;
}) {
  const label = tenantSlug ? `${tenantSlug}.rooms.simhq.app` : host;

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-2xl content-center px-4 py-10">
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <AlertTriangle className="size-8 text-primary" />
        <h1 className="mt-4 text-2xl font-semibold text-foreground">
          Workspace not found
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {label
            ? `We could not find an active ${APP_NAME} workspace for ${label}.`
            : `We could not find an active ${APP_NAME} workspace for this address.`}
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Go to {APP_NAME}
        </Link>
      </section>
    </main>
  );
}
