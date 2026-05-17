import { HomeLanding } from "@/components/home-landing";
import { PublicNav, PageShell } from "@/components/ui";
import { TenantNotFound } from "@/components/tenant-not-found";
import { resolveTenantForRequest } from "@/lib/server-tenant";
import { getTenantAwareLinkFor } from "@/lib/server-tenant-url";
import { APP_NAME } from "@/lib/config";

export const dynamic = "force-dynamic";

type HomeProps = {
  searchParams: Promise<{ tenant?: string | string[] }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const tenantParam = Array.isArray(params.tenant) ? params.tenant[0] : params.tenant;
  const tenant = await resolveTenantForRequest(
    tenantParam ? new URLSearchParams({ tenant: tenantParam }) : undefined,
  );
  const linkFor = await getTenantAwareLinkFor({
    tenantFromQuery: tenantParam,
    selectedTenantSlug: tenant.ok ? tenant.tenant.slug : undefined,
  });

  if (!tenant.ok && tenant.reason === "not_found") {
    return (
      <TenantNotFound
        tenantSlug={tenant.requestedTenantSlug}
        host={tenant.requestedHost}
      />
    );
  }

  return (
    <>
      <PublicNav tenantName={tenant.ok ? tenant.tenant.name : undefined} linkFor={linkFor} />
      <PageShell>
        {tenant.ok ? (
          <HomeLanding tenantSlug={tenant.tenant.slug} />
        ) : (
          <section className="py-10">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              {APP_NAME} Rooms
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
              Sign in to choose a workspace, or open your organisation&apos;s
              tenant subdomain to book rooms and view public activity.
            </p>
            <div className="mt-6">
              <a
                href={`/auth/sign-in?returnTo=${encodeURIComponent(linkFor("/dashboard"))}`}
                className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90"
              >
                Staff sign in
              </a>
            </div>
          </section>
        )}
      </PageShell>
    </>
  );
}
