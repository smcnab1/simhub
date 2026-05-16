import { BookingWizard } from "@/components/booking-wizard";
import { PublicNav, PageShell } from "@/components/ui";
import { TenantNotFound } from "@/components/tenant-not-found";
import { resolveTenantForRequest } from "@/lib/server-tenant";

export const dynamic = "force-dynamic";

type BookingWizardPageProps = {
  searchParams: Promise<{ tenant?: string | string[] }>;
};

export default async function BookingWizardPage({ searchParams }: BookingWizardPageProps) {
  const params = await searchParams;
  const tenantParam = Array.isArray(params.tenant) ? params.tenant[0] : params.tenant;
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
      <PublicNav tenantName={tenant.tenant.name} />
      <PageShell>
        <BookingWizard tenantSlug={tenant.tenant.slug} />
      </PageShell>
    </>
  );
}
