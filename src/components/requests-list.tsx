"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useDashboardAuth } from "@/components/dashboard-auth";
import { RequestCard, SectionHeader } from "@/components/ui";
import { formatRequestDate, formatRooms } from "@/lib/format";

const statuses = ["Pending", "Approved", "Completed", "Declined", "Cancelled"];

export function RequestsList() {
  const auth = useDashboardAuth();
  const tenantSlug = auth.tenantSlug;
  const requests = useQuery(api.bookings.listRequests, { tenantSlug, auth });

  return (
    <>
      <SectionHeader title="Requests" eyebrow="Workflow" />
      <div className="mb-4 flex flex-wrap gap-2">
        {statuses.map((status) => <button key={status} className="rounded-full border border-blue-100 bg-white px-3 py-1.5 text-sm">{status}</button>)}
      </div>
      <div className="grid gap-3">
        {(requests ?? []).map((request) => (
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
        {requests?.length === 0 ? <p className="rounded-2xl border border-dashed border-blue-100 bg-white/70 p-5 text-sm text-slate-500">No requests in Convex yet.</p> : null}
      </div>
    </>
  );
}
