import { PublicCalendar } from "@/components/public-calendar";
import { PublicNav, PageShell } from "@/components/ui";
import { api } from "../../../../../../convex/_generated/api";
import { fetchQuery } from "convex/nextjs";

export const dynamic = "force-dynamic";

type TenantPublicEventsPageProps = {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ month?: string | string[] }>;
};

export default async function TenantPublicEventsPage({
  params,
  searchParams,
}: TenantPublicEventsPageProps) {
  const [{ tenantSlug }, query] = await Promise.all([params, searchParams]);
  const month = Array.isArray(query.month) ? query.month[0] : query.month;
  const tenant = await fetchQuery(api.tenants.getPublicTenantBySlug, {
    slug: tenantSlug,
  });

  return (
    <>
      <PublicNav
        tenantName={tenant?.name}
        tenantLogoUrl={tenant?.logoUrl ?? undefined}
      />
      <PageShell>
        <PublicCalendar tenantSlug={tenantSlug} initialMonth={month} />
      </PageShell>
    </>
  );
}
