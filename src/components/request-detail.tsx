"use client";

import { FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, Info } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useOptionalDashboardAuth } from "@/components/dashboard-auth";
import { Card, SectionHeader, StatusPill } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { formFieldClass, primaryButtonClass } from "@/components/ui";
import { formatRooms } from "@/lib/format";
import { TENANT_SLUG } from "@/lib/config";

function severityLabel(severity: string) {
  return severity === "likely_unavailable"
    ? "Likely unavailable"
    : severity === "warning"
      ? "Warning"
      : "Informational";
}

function severityClass(severity: string) {
  if (severity === "likely_unavailable") {
    return "border-destructive/35 bg-destructive/10 text-destructive";
  }

  if (severity === "warning") {
    return "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200";
  }

  return "border-primary/30 bg-primary/10 text-primary";
}

export function RequestDetail({ id, publicView = false }: { id: string; publicView?: boolean }) {
  const auth = useOptionalDashboardAuth();
  const searchParams = useSearchParams();
  const emailFromUrl = searchParams.get("email")?.trim() ?? "";
  const tenantSlug = auth?.tenantSlug ?? "";
  const publicLookupArgs = publicView && emailFromUrl
    ? {
        tenantSlug: TENANT_SLUG,
        requestId: id as Id<"bookingRequests">,
        requesterEmail: emailFromUrl,
      }
    : "skip";
  const request = useQuery(
    publicView ? api.bookings.getPublicRequestByReference : api.bookings.getRequest,
    publicView ? publicLookupArgs : { tenantSlug, auth: auth ?? {}, requestId: id as Id<"bookingRequests"> }
  );
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

  if (publicView && !emailFromUrl) {
    return (
      <>
        <SectionHeader eyebrow="Requester tracking" title="Access booking request" />
        <Card>
          <form method="get" className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <label>
              <span className="text-sm font-medium text-foreground">Requester email</span>
              <input name="email" type="email" required className={formFieldClass} />
            </label>
            <button className={primaryButtonClass}>View request</button>
          </form>
          <p className="mt-3 text-sm text-muted-foreground">
            Use the booking reference in the URL and the email address used when submitting the request.
          </p>
        </Card>
      </>
    );
  }

  if (request === undefined) return <p className="rounded-2xl border border-border bg-card/80 p-5 text-sm text-muted-foreground">Loading request...</p>;
  if (!request) return <p className="rounded-2xl border border-dashed border-border bg-card/80 p-5 text-sm text-muted-foreground">Request not found.</p>;

  return (
    <>
      <SectionHeader eyebrow={publicView ? "Requester tracking" : request._id} title={request.sessionName} action={<StatusPill status={request.status} />} />
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="grid gap-5">
          <Card>
            <h2 className="font-semibold">Requester and booking blocks</h2>
            <dl className="mt-4 grid gap-3 md:grid-cols-3">
              <div><dt className="text-sm text-muted-foreground">Requester</dt><dd className="font-medium">{request.requesterName}</dd></div>
              <div><dt className="text-sm text-muted-foreground">Attendees</dt><dd className="font-medium">{request.attendeeCount}</dd></div>
              <div><dt className="text-sm text-muted-foreground">Rooms</dt><dd className="font-medium">{formatRooms(request)}</dd></div>
              <div><dt className="text-sm text-muted-foreground">Room request mode</dt><dd className="font-medium">{request.roomSelectionMode === "SpecificRooms" ? "Specific rooms" : "Room type quantity"}</dd></div>
              <div><dt className="text-sm text-muted-foreground">Email</dt><dd className="font-medium">{request.requesterEmail}</dd></div>
              <div><dt className="text-sm text-muted-foreground">Phone</dt><dd className="font-medium">{request.requesterPhone || "Not provided"}</dd></div>
              <div><dt className="text-sm text-muted-foreground">CC</dt><dd className="font-medium">{request.ccEmails.length ? request.ccEmails.join(", ") : "None"}</dd></div>
            </dl>
            <div className="mt-4 grid gap-2">
              {request.requestedRooms?.length ? (
                <div className="rounded-xl border border-border bg-muted/40 p-3">
                  <p className="text-sm font-medium text-foreground">Requested exact rooms</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {request.requestedRooms.map((room) => (
                      <Badge key={room._id} variant="outline">{room.name} ({room.code}) · {room.capacity}</Badge>
                    ))}
                  </div>
                </div>
              ) : null}
              {request.roomTypeRequestDetails?.length ? (
                <div className="rounded-xl border border-border bg-muted/40 p-3">
                  <p className="text-sm font-medium text-foreground">Requested room type quantities</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {request.roomTypeRequestDetails.map((item) => (
                      <Badge key={item.roomTypeId} variant="outline">
                        {item.quantity} {item.roomTypeName}{item.quantity === 1 ? "" : "s"} · ~{item.quantity * item.defaultCapacity}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <p className="mt-4 rounded-xl bg-card/80 p-3 text-sm text-foreground">{request.details}</p>
            <div className="mt-4 grid gap-2">
              {request.blocks.map((block) => <p key={`${block.label}-${block.start}`} className="rounded-xl bg-muted p-3 text-sm">{block.label}: {block.start} to {block.end}</p>)}
            </div>
          </Card>
          <Card>
            <h2 className="font-semibold">Custom form inputs</h2>
            <div className="mt-3 grid gap-2">
              {request.customInputs.map((field) => <p key={field.fieldId} className="text-sm text-muted-foreground">{field.label}: <span className="text-foreground">{String(field.value)}</span></p>)}
              {request.customInputs.length === 0 ? <p className="text-sm text-muted-foreground">No custom inputs captured.</p> : null}
            </div>
          </Card>
          <Card>
            <h2 className="font-semibold">Comments</h2>
            <div className="mt-3 grid gap-2">
              {request.comments.map((comment) => <p key={comment._id} className="rounded-xl bg-card/80 p-3 text-sm text-muted-foreground">{comment.bodyMarkdown}</p>)}
              {request.comments.length === 0 ? <p className="text-sm text-muted-foreground">No comments yet.</p> : null}
            </div>
            {!publicView ? (
              <form onSubmit={onComment} className="mt-3 grid gap-2">
                <textarea name="comment" placeholder="Add a comment..." className="min-h-24 rounded-xl border border-border px-3 py-2 text-sm" />
                <button className="justify-self-start rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">Add comment</button>
              </form>
            ) : null}
          </Card>
        </div>
        <div className="grid content-start gap-5">
          {!publicView ? (
            <Card>
              <h2 className="font-semibold">Workflow actions</h2>
              {request.conflictMetadata?.conflicts.length ? (
                <p className="mt-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  This request has availability warnings. Approval is still available for admin review.
                </p>
              ) : null}
              <div className="mt-3 grid gap-2">
                <button onClick={() => updateStatus({ tenantSlug, auth: auth ?? {}, requestId: request._id, status: "Approved" })} className="rounded-xl border border-border px-3 py-2 text-sm font-medium">Approve</button>
                <button onClick={() => updateStatus({ tenantSlug, auth: auth ?? {}, requestId: request._id, status: "Declined" })} className="rounded-xl border border-border px-3 py-2 text-sm font-medium">Decline</button>
                <button onClick={() => updateStatus({ tenantSlug, auth: auth ?? {}, requestId: request._id, status: "Pending" })} className="rounded-xl border border-border px-3 py-2 text-sm font-medium">Remain Pending</button>
              </div>
            </Card>
          ) : null}
          {!publicView ? (
            <Card>
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold">Availability conflicts</h2>
                {request.conflictMetadata?.highestSeverity ? (
                  <Badge variant="outline" className={severityClass(request.conflictMetadata.highestSeverity)}>
                    {severityLabel(request.conflictMetadata.highestSeverity)}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">Clear</Badge>
                )}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {request.conflictMetadata?.summary ?? "No availability conflicts detected."}
              </p>
              <div className="mt-3 grid gap-2">
                {request.conflictMetadata?.conflicts.map((conflict, index) => (
                  <div key={`${conflict.type}-${index}`} className={`rounded-xl border p-3 text-sm ${severityClass(conflict.severity)}`}>
                    <div className="flex items-start gap-2">
                      {conflict.severity === "informational" ? <Info className="mt-0.5 size-4 shrink-0" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" />}
                      <div className="min-w-0">
                        <p className="font-medium">{conflict.message}</p>
                        <div className="mt-2 grid gap-1 text-xs opacity-85">
                          <div>Type: {conflict.type}</div>
                          {conflict.roomCode ? <div>Room: {conflict.roomCode} {conflict.roomName ? `(${conflict.roomName})` : ""}</div> : null}
                          {conflict.roomTypeName ? <div>Room type: {conflict.roomTypeName}</div> : null}
                          {conflict.campusName ? <div>Campus: {conflict.campusName}</div> : null}
                          {conflict.blockedReason ? <div>Blocked reason: {conflict.blockedReason}</div> : null}
                          {conflict.conflictingRequestId ? <div>Conflicting request: {conflict.conflictingRequestId}</div> : null}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {request.conflictMetadata?.conflicts.length === 0 || !request.conflictMetadata ? (
                  <p className="rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                    No conflicts detected against approved bookings, pending bookings, or blocked periods.
                  </p>
                ) : null}
              </div>
            </Card>
          ) : null}
          <Card>
            <h2 className="font-semibold">Files</h2>
            <p className="mt-2 text-sm text-muted-foreground">{request.attachmentStorageIds.length} attachment(s)</p>
          </Card>
        </div>
      </div>
    </>
  );
}
