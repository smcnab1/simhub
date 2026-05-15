import { PublicCalendar } from "@/components/public-calendar";
import { PublicNav, PageShell } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function PublicCalendarPage() {
  return (
    <>
      <PublicNav />
      <PageShell>
        <PublicCalendar />
      </PageShell>
    </>
  );
}
