import { BookingWizard } from "@/components/booking-wizard";
import { PublicNav, PageShell } from "@/components/ui";
import { TenantNotFound } from "@/components/tenant-not-found";
import { resolveTenantForRequest } from "@/lib/server-tenant";
import { getPublicDashboardHref, getTenantAwareLinkFor } from "@/lib/server-tenant-url";
import { demoTenantFallbackEnabled } from "@/lib/tenant-url";

export const dynamic = "force-dynamic";

type BookingWizardPageProps = {
  searchParams: Promise<{ tenant?: string | string[] }>;
};

export default async function BookingWizardPage({ searchParams }: BookingWizardPageProps) {
  const params = await searchParams;
  const tenantParam = Array.isArray(params.tenant) ? params.tenant[0] : params.tenant;
  const tenant = await resolveTenantForRequest(
    tenantParam ? new URLSearchParams({ tenant: tenantParam }) : undefined,
    { fallbackToDefault: demoTenantFallbackEnabled() }
  );

  if (!tenant.ok) {
    return (
      <TenantNotFound
        tenantSlug={tenant.requestedTenantSlug}
        host={tenant.requestedHost}
      />
    );
  }

  const linkFor = await getTenantAwareLinkFor({
    tenantFromQuery: tenantParam,
    selectedTenantSlug: tenant.tenant.slug,
  });
  const dashboardHref = await getPublicDashboardHref();

  return (
    <>
      <PublicNav
        tenantName={tenant.tenant.name}
        linkFor={linkFor}
        dashboardHref={dashboardHref}
      />
      <PageShell>
        <BookingWizard tenantSlug={tenant.tenant.slug} />
      </PageShell>
    </>
  );
}
