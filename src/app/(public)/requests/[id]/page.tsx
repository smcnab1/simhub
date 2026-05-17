import { RequestDetail } from "@/components/request-detail";
import { PublicNav, PageShell } from "@/components/ui";
import { TenantNotFound } from "@/components/tenant-not-found";
import { resolveTenantForRequest } from "@/lib/server-tenant";

export const dynamic = "force-dynamic";

export default async function RequestTrackingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tenant?: string | string[] }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const tenantParam = Array.isArray(query.tenant) ? query.tenant[0] : query.tenant;
  const tenant = await resolveTenantForRequest(
    tenantParam ? new URLSearchParams({ tenant: tenantParam }) : undefined,
    { fallbackToDefault: true }
  );

  if (!tenant.ok) {
    return (
      <TenantNotFound
        tenantSlug={tenant.requestedTenantSlug}
        host={tenant.requestedHost}
      />
    );
  }

  return (
    <>
      <PublicNav
        tenantName={tenant.tenant.name}
        tenantLogoUrl={tenant.tenant.logoUrl}
      />
      <PageShell>
        <RequestDetail id={id} tenantSlug={tenant.tenant.slug} publicView />
      </PageShell>
    </>
  );
}
