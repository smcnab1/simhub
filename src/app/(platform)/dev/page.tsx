import { PlatformDevPage } from "@/components/platform/platform-dev-page";

export default function PlatformDeveloperPage() {
  return (
    <PlatformDevPage
      title="Developer Dashboard"
      description="Root-domain platform controls for tenant operations, bootstrap workflows, and cross-tenant support."
      activeHref="/dev"
    >
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">Platform scope</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          These tools use platform Developer auth and do not require a tenant
          subdomain, tenant cookie, or tenant membership match.
        </p>
      </section>
    </PlatformDevPage>
  );
}
