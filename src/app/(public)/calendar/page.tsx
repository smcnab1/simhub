import { PublicCalendar } from "@/components/public-calendar";
import { PublicNav, PageShell } from "@/components/ui";

export const dynamic = "force-dynamic";

type PublicCalendarPageProps = {
  searchParams: Promise<{ month?: string | string[] }>;
};

export default async function PublicCalendarPage({ searchParams }: PublicCalendarPageProps) {
  const params = await searchParams;
  const month = Array.isArray(params.month) ? params.month[0] : params.month;

  return (
    <>
      <PublicNav />
      <PageShell>
        <PublicCalendar initialMonth={month} />
      </PageShell>
    </>
  );
}
