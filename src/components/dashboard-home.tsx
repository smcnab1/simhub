"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useDashboardAuth } from "@/components/dashboard-auth";
import { Metric, RequestCard, SectionHeader } from "@/components/ui";
import { formatRequestDate, formatRooms } from "@/lib/format";

export function DashboardHome() {
  const auth = useDashboardAuth();
  const tenantSlug = auth.tenantSlug;
  const summary = useQuery(api.bookings.dashboardSummary, { tenantSlug, auth });
  const requests = useQuery(api.bookings.listRequests, { tenantSlug, auth });

  return (
    <>
      <SectionHeader eyebrow="Admin and staff" title="Operations Dashboard" />
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Pending requests" value={String(summary?.pending ?? 0)} detail="Need staff review" />
        <Metric label="Approved sessions" value={String(summary?.approved ?? 0)} detail="Visible on public calendar" />
        <Metric label="Unseen notifications" value={String(summary?.unseen ?? 0)} />
        <Metric label="Blocked times" value={String(summary?.conflicts ?? 0)} detail="Calendar holds" />
      </div>
      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Recent requests</h2>
        <a href="/dashboard/resource-calendar" className="rounded-lg border border-border bg-card/80 px-3 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted">Open calendar</a>
      </div>
      <div className="mt-6 grid gap-3">
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
        {requests?.length === 0 ? <p className="rounded-2xl border border-dashed border-border bg-card/80 p-5 text-sm text-muted-foreground">No booking requests in Convex yet.</p> : null}
      </div>
    </>
  );
}
