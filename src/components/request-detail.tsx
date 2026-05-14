"use client";

import { FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useOptionalDashboardAuth } from "@/components/dashboard-auth";
import { Card, SectionHeader, StatusPill } from "@/components/ui";
import { formatRooms } from "@/lib/format";

export function RequestDetail({ id, publicView = false }: { id: string; publicView?: boolean }) {
  const auth = useOptionalDashboardAuth();
  const tenantSlug = auth?.tenantSlug ?? "";
  const request = useQuery(api.bookings.getRequest, publicView ? { requestId: id as Id<"bookingRequests"> } : { tenantSlug, auth: auth ?? {}, requestId: id as Id<"bookingRequests"> });
  const updateStatus = useMutation(api.bookings.updateStatus);
  const addComment = useMutation(api.bookings.addComment);

  async function onComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const bodyMarkdown = String(new FormData(form).get("comment") ?? "").trim();
    if (!bodyMarkdown) return;
    await addComment({ tenantSlug, auth: auth ?? {}, requestId: id as Id<"bookingRequests">, bodyMarkdown, internal: !publicView });
    form.reset();
  }

  if (request === undefined) return <p className="rounded-2xl border border-blue-100 bg-white/70 p-5 text-sm text-slate-500">Loading request...</p>;
  if (!request) return <p className="rounded-2xl border border-dashed border-blue-100 bg-white/70 p-5 text-sm text-slate-500">Request not found.</p>;

  return (
    <>
      <SectionHeader eyebrow={publicView ? "Requester tracking" : request._id} title={request.sessionName} action={<StatusPill status={request.status} />} />
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="grid gap-5">
          <Card>
            <h2 className="font-semibold">Requester and booking blocks</h2>
            <dl className="mt-4 grid gap-3 md:grid-cols-3">
              <div><dt className="text-sm text-slate-500">Requester</dt><dd className="font-medium">{request.requesterName}</dd></div>
              <div><dt className="text-sm text-slate-500">Attendees</dt><dd className="font-medium">{request.attendeeCount}</dd></div>
              <div><dt className="text-sm text-slate-500">Rooms</dt><dd className="font-medium">{formatRooms(request)}</dd></div>
              <div><dt className="text-sm text-slate-500">Email</dt><dd className="font-medium">{request.requesterEmail}</dd></div>
              <div><dt className="text-sm text-slate-500">Phone</dt><dd className="font-medium">{request.requesterPhone || "Not provided"}</dd></div>
              <div><dt className="text-sm text-slate-500">CC</dt><dd className="font-medium">{request.ccEmails.length ? request.ccEmails.join(", ") : "None"}</dd></div>
            </dl>
            <p className="mt-4 rounded-xl bg-white/70 p-3 text-sm text-slate-700">{request.details}</p>
            <div className="mt-4 grid gap-2">
              {request.blocks.map((block) => <p key={`${block.label}-${block.start}`} className="rounded-xl bg-blue-50 p-3 text-sm">{block.label}: {block.start} to {block.end}</p>)}
            </div>
          </Card>
          <Card>
            <h2 className="font-semibold">Custom form inputs</h2>
            <div className="mt-3 grid gap-2">
              {request.customInputs.map((field) => <p key={field.fieldId} className="text-sm text-slate-600">{field.label}: <span className="text-slate-900">{String(field.value)}</span></p>)}
              {request.customInputs.length === 0 ? <p className="text-sm text-slate-500">No custom inputs captured.</p> : null}
            </div>
          </Card>
          <Card>
            <h2 className="font-semibold">Comments</h2>
            <div className="mt-3 grid gap-2">
              {request.comments.map((comment) => <p key={comment._id} className="rounded-xl bg-white/70 p-3 text-sm text-slate-600">{comment.bodyMarkdown}</p>)}
              {request.comments.length === 0 ? <p className="text-sm text-slate-500">No comments yet.</p> : null}
            </div>
            {!publicView ? (
              <form onSubmit={onComment} className="mt-3 grid gap-2">
                <textarea name="comment" placeholder="Add a comment..." className="min-h-24 rounded-xl border border-blue-100 px-3 py-2 text-sm" />
                <button className="justify-self-start rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white">Add comment</button>
              </form>
            ) : null}
          </Card>
        </div>
        <div className="grid content-start gap-5">
          {!publicView ? (
            <Card>
              <h2 className="font-semibold">Workflow actions</h2>
              <div className="mt-3 grid gap-2">
                <button onClick={() => updateStatus({ tenantSlug, auth: auth ?? {}, requestId: request._id, status: "Approved" })} className="rounded-xl border border-blue-100 px-3 py-2 text-sm font-medium">Approve</button>
                <button onClick={() => updateStatus({ tenantSlug, auth: auth ?? {}, requestId: request._id, status: "Declined" })} className="rounded-xl border border-blue-100 px-3 py-2 text-sm font-medium">Decline</button>
                <button onClick={() => updateStatus({ tenantSlug, auth: auth ?? {}, requestId: request._id, status: "Pending" })} className="rounded-xl border border-blue-100 px-3 py-2 text-sm font-medium">Remain Pending</button>
              </div>
            </Card>
          ) : null}
          <Card>
            <h2 className="font-semibold">Files</h2>
            <p className="mt-2 text-sm text-slate-600">{request.attachmentStorageIds.length} attachment(s)</p>
          </Card>
        </div>
      </div>
    </>
  );
}
