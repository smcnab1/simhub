import { RequestsTriageList } from "@/components/requests/requests-triage-list";
import { APP_NAME } from "@/lib/config";

export const metadata = {
  title: `Booking Requests - ${APP_NAME}`,
  description: "Review, filter, and triage booking requests.",
};

export default function RequestsPage() {
  return <RequestsTriageList />;
}
