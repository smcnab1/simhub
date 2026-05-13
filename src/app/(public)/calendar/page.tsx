import { PublicCalendar } from "@/components/public-calendar";
import { PublicNav, PageShell } from "@/components/ui";

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
