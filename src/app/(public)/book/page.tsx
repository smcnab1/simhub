import { BookingWizard } from "@/components/booking-wizard";
import { PublicNav, PageShell } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function BookingWizardPage() {
  return (
    <>
      <PublicNav />
      <PageShell>
        <BookingWizard />
      </PageShell>
    </>
  );
}
