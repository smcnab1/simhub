import { BookingWizard } from "@/components/booking-wizard";
import { PublicNav, PageShell } from "@/components/ui";

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
