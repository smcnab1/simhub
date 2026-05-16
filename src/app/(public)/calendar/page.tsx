import { PublicCalendar } from "@/components/public-calendar";
import { PublicNav, PageShell } from "@/components/ui";
import { TenantNotFound } from "@/components/tenant-not-found";
import { resolveTenantForRequest } from "@/lib/server-tenant";

export const dynamic = "force-dynamic";

type PublicCalendarPageProps = {
  searchParams: Promise<{ month?: string | string[]; tenant?: string | string[] }>;
};

export default async function PublicCalendarPage({ searchParams }: PublicCalendarPageProps) {
  const params = await searchParams;
  const month = Array.isArray(params.month) ? params.month[0] : params.month;
  const tenantParam = Array.isArray(params.tenant) ? params.tenant[0] : params.tenant;
  const urlSearchParams = new URLSearchParams();

  if (tenantParam) urlSearchParams.set("tenant", tenantParam);

  const tenant = await resolveTenantForRequest(urlSearchParams, {
    fallbackToDefault: true,
  });

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
        <PublicCalendar tenantSlug={tenant.tenant.slug} initialMonth={month} />
      </PageShell>
    </>
  );
}
