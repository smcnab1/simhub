"use client";

import { useQuery } from "convex/react";
import { FileText } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { CardSkeletonList, EmptyState } from "@/components/app-state";
import { useDashboardAuth } from "@/components/dashboard-auth";
import { RequestCard, SectionHeader } from "@/components/ui";
import { formatRequestDate, formatRooms } from "@/lib/format";

const statuses = ["Pending", "Approved", "Confirmed", "Completed", "Declined", "Cancelled"];

export function RequestsList() {
  const auth = useDashboardAuth();
  const tenantSlug = auth.tenantSlug;
  const requests = useQuery(api.bookings.listRequests, { tenantSlug, auth });
  const isLoading = requests === undefined;

  return (
    <>
      <SectionHeader title="Requests" eyebrow="Workflow" />
      <div className="mb-4 flex flex-wrap gap-2">
        {statuses.map((status) => <button key={status} className="rounded-full border border-border bg-card px-3 py-1.5 text-sm">{status}</button>)}
      </div>
      {isLoading ? (
        <CardSkeletonList />
      ) : requests.length > 0 ? (
        <div className="grid gap-3">
          {requests.map((request) => (
          <RequestCard
            key={request._id}
            request={{
              id: request._id,
              sessionName: request.sessionName,
              requesterName: request.requesterName,
              date: formatRequestDate(request),
              rooms: [formatRooms(request)],
              status: request.status,
            }}
          />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          title="No requests yet"
          message="Booking requests submitted by requesters will appear here. Use the booking form to create the first one."
          action={{ label: "Create request", href: "/book" }}
        />
      )}
    </>
  );
}
