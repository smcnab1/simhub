"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useDashboardAuth } from "@/components/dashboard-auth";
import { Card, SectionHeader } from "@/components/ui";

export function NotificationsList() {
  const auth = useDashboardAuth();
  const tenantSlug = auth.tenantSlug;
  const notifications = useQuery(api.notifications.unseenByTenantSlug, { tenantSlug, auth });
  const markAllSeen = useMutation(api.notifications.markAllSeen);

  return (
    <>
      <SectionHeader title="Notifications" eyebrow={`${notifications?.length ?? 0} unseen`} action={<button onClick={() => markAllSeen({ tenantSlug, auth })} className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-blue-50">Mark all seen</button>} />
      <Card>
        {(notifications ?? []).map((item) => (
          <div key={item._id} className="border-b border-blue-100 py-3 last:border-0">
            <p className="font-medium text-slate-950">{item.message}</p>
            <p className="text-sm text-slate-500">Unseen · {new Date(item.createdAt).toLocaleString()}</p>
          </div>
        ))}
        {notifications?.length === 0 ? <p className="text-sm text-slate-500">No unseen notifications in Convex yet.</p> : null}
      </Card>
    </>
  );
}
