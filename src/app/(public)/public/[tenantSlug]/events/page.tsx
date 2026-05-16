import { PublicCalendar } from "@/components/public-calendar";
import { PublicNav, PageShell } from "@/components/ui";

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

  return (
    <>
      <PublicNav />
      <PageShell>
        <PublicCalendar tenantSlug={tenantSlug} initialMonth={month} />
      </PageShell>
    </>
  );
}
