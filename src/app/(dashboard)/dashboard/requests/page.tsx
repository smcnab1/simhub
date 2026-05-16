import { RequestsTriageList } from "@/components/requests/requests-triage-list";

export const metadata = {
  title: "Booking Requests — SimHub",
  description: "Review, filter, and triage booking requests.",
};

export default function RequestsPage() {
  return <RequestsTriageList />;
}
