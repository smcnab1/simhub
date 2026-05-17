import { RequestDetail } from "@/components/request-detail";
import { PublicNav, PageShell } from "@/components/ui";
import { TenantNotFound } from "@/components/tenant-not-found";
import { resolveTenantForRequest } from "@/lib/server-tenant";
import { getPublicDashboardHref } from "@/lib/server-tenant-url";

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
  const dashboardHref = await getPublicDashboardHref();

  return (
    <>
      <PublicNav tenantName={tenant.tenant.name} dashboardHref={dashboardHref} />
      <PageShell>
        <RequestDetail id={id} tenantSlug={tenant.tenant.slug} publicView />
      </PageShell>
    </>
  );
}
