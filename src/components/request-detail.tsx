"use client";

import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, Info, LoaderCircle, Search, X } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useOptionalDashboardAuth } from "@/components/dashboard-auth";
import { Card, SectionHeader, StatusPill } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formFieldClass, primaryButtonClass } from "@/components/ui";
import { formatBlockTime, formatRooms } from "@/lib/format";
import { TENANT_SLUG } from "@/lib/config";
import {
  formatBookingDuration,
  occupancyDurationMinutes,
  sessionDurationMinutes,
} from "@/lib/booking-logic";

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

type RoomOption = {
  _id: Id<"rooms">;
  code: string;
  name: string;
  capacity: number;
  active: boolean;
  roomType?: { name?: string } | null;
  campus?: { name?: string } | null;
};

type AllocationRequest = {
  _id: Id<"bookingRequests">;
  status: "Pending" | "Approved" | "Confirmed" | "Completed" | "Declined" | "Cancelled";
  assignedRoomIds?: Id<"rooms">[];
  assignedRooms?: Array<{ _id: Id<"rooms">; code: string; name: string }>;
  allocationStatus?: string;
  allocationNotes?: string;
  allocationUpdatedAt?: number;
  allocationUpdatedBy?: {
    name: string;
    email: string;
    role: string;
  } | null;
  updatedAt: number;
};

function formatAuditTime(value?: number) {
  if (!value) return "Not recorded";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function ManualAllocationPanel({
  request,
  rooms,
  tenantSlug,
  auth,
}: {
  request: AllocationRequest;
  rooms?: RoomOption[];
  tenantSlug: string;
  auth: NonNullable<ReturnType<typeof useOptionalDashboardAuth>>;
}) {
  const updateAllocation = useMutation(api.bookings.updateAllocation);
  const [selectedRoomIds, setSelectedRoomIds] = useState<Id<"rooms">[]>(
    request.assignedRoomIds ?? []
  );
  const [notes, setNotes] = useState(request.allocationNotes ?? "");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedRoomIdSet = useMemo(
    () => new Set<string>(selectedRoomIds),
    [selectedRoomIds]
  );
  const preview = useQuery(api.bookings.previewManualAllocation, {
    tenantSlug,
    auth,
    requestId: request._id,
    assignedRoomIds: selectedRoomIds,
  });
  const filteredRooms = useMemo(() => {
    const term = query.trim().toLowerCase();

    return (rooms ?? []).filter((room) => {
      if (!term) return true;
      return [room.name, room.code, room.roomType?.name, room.campus?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [query, rooms]);
  const selectedRooms = useMemo(
    () =>
      selectedRoomIds.map(
        (roomId) =>
          rooms?.find((room) => room._id === roomId) ??
          request.assignedRooms?.find((room) => room._id === roomId)
      ),
    [request.assignedRooms, rooms, selectedRoomIds]
  );
  const hasChanges =
    selectedRoomIds.join("|") !== (request.assignedRoomIds ?? []).join("|") ||
    notes.trim() !== (request.allocationNotes ?? "");

  function toggleRoom(roomId: Id<"rooms">) {
    setSelectedRoomIds((current) =>
      current.includes(roomId)
        ? current.filter((id) => id !== roomId)
        : [...current, roomId]
    );
  }

  function reset() {
    setSelectedRoomIds(request.assignedRoomIds ?? []);
    setNotes(request.allocationNotes ?? "");
    setError(null);
  }

  async function save() {
    setSaving(true);
    setError(null);

    try {
      await updateAllocation({
        tenantSlug,
        auth,
        requestId: request._id,
        assignedRoomIds: selectedRoomIds,
        allocationNotes: notes,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save allocation.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-muted/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">Allocation management</p>
          <p className="text-xs text-muted-foreground">
            Last updated by {request.allocationUpdatedBy?.name ?? "unknown"} · {formatAuditTime(request.allocationUpdatedAt)}
          </p>
        </div>
        <Badge variant="outline">{request.allocationStatus ?? "Unallocated"}</Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {selectedRooms.map((room, index) =>
          room ? (
            <button
              key={room._id}
              type="button"
              onClick={() => toggleRoom(room._id)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium"
            >
              {room.name} ({room.code}) <X className="size-3" />
            </button>
          ) : (
            <Badge key={`${selectedRoomIds[index]}-${index}`} variant="outline">
              Unknown room
            </Badge>
          )
        )}
        {selectedRooms.length === 0 ? (
          <span className="text-sm text-muted-foreground">No rooms assigned.</span>
        ) : null}
      </div>

      <div className="mt-3 grid gap-2">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="room-search">
          Search rooms
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="room-search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            className="pl-9"
            placeholder="Room, code, type, or campus"
          />
        </div>
        <div className="grid max-h-64 gap-2 overflow-auto rounded-lg border border-border bg-background p-2">
          {filteredRooms.map((room) => {
            const selected = selectedRoomIdSet.has(room._id);

            return (
              <button
                key={room._id}
                type="button"
                onClick={() => toggleRoom(room._id)}
                className={`grid rounded-lg border p-2 text-left text-sm ${selected ? "border-primary bg-primary/10" : "border-border bg-card"}`}
              >
                <span className="font-medium text-foreground">{room.name} ({room.code})</span>
                <span className="text-xs text-muted-foreground">
                  {room.roomType?.name ?? "Unknown type"} · {room.campus?.name ?? "No campus"} · capacity {room.capacity}
                  {room.active ? "" : " · inactive"}
                </span>
              </button>
            );
          })}
          {rooms === undefined ? (
            <p className="text-sm text-muted-foreground">Loading rooms...</p>
          ) : null}
          {rooms !== undefined && filteredRooms.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rooms match that search.</p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="allocation-notes">
          Allocation notes
        </label>
        <Textarea
          id="allocation-notes"
          value={notes}
          onChange={(event) => setNotes(event.currentTarget.value)}
          placeholder="Moved due to maintenance"
        />
      </div>

      <div className="mt-3 grid gap-2">
        {preview === undefined ? (
          <p className="rounded-lg border border-border bg-background p-2 text-sm text-muted-foreground">
            Checking selected rooms...
          </p>
        ) : preview.conflicts.length ? (
          preview.conflicts.map((conflict, index) => (
            <div key={`${conflict.type}-${index}`} className={`rounded-lg border p-2 text-sm ${severityClass(conflict.severity)}`}>
              <div className="flex gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-medium">{conflict.message}</p>
                  {conflict.roomCode ? <p className="text-xs opacity-85">Room: {conflict.roomCode}</p> : null}
                  {conflict.blockedReason ? <p className="text-xs opacity-85">Blocked: {conflict.blockedReason}</p> : null}
                  {conflict.conflictingRequestId ? <p className="text-xs opacity-85">Conflicting request: {conflict.conflictingRequestId}</p> : null}
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-lg border border-primary/30 bg-primary/10 p-2 text-sm text-primary">
            No conflicts detected for this manual allocation.
          </p>
        )}
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" onClick={save} disabled={!hasChanges || saving}>
          {saving ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Save allocation
        </Button>
        <Button type="button" variant="outline" onClick={reset} disabled={!hasChanges || saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
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
  const rooms = useQuery(
    api.tenants.listPrivateRooms,
    publicView || !auth ? "skip" : { tenantSlug, auth, activeOnly: false }
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

  const sessionLength = sessionDurationMinutes(request.blocks);
  const occupancyLength = occupancyDurationMinutes(request.blocks);

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
              <div><dt className="text-sm text-muted-foreground">Allocation</dt><dd className="font-medium">{request.allocationStatus ?? "Unallocated"}</dd></div>
              <div><dt className="text-sm text-muted-foreground">Email</dt><dd className="font-medium">{request.requesterEmail}</dd></div>
              <div><dt className="text-sm text-muted-foreground">Phone</dt><dd className="font-medium">{request.requesterPhone || "Not provided"}</dd></div>
              <div><dt className="text-sm text-muted-foreground">CC</dt><dd className="font-medium">{request.ccEmails.length ? request.ccEmails.join(", ") : "None"}</dd></div>
              <div><dt className="text-sm text-muted-foreground">Session length</dt><dd className="font-medium">{sessionLength !== null ? formatBookingDuration(sessionLength) : "Invalid"}</dd></div>
              <div><dt className="text-sm text-muted-foreground">Reserved room time</dt><dd className="font-medium">{occupancyLength !== null ? formatBookingDuration(occupancyLength) : "Invalid"}</dd></div>
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
              {!publicView && auth ? (
                <ManualAllocationPanel
                  key={`${request._id}-${request.updatedAt}`}
                  request={request}
                  rooms={rooms}
                  tenantSlug={tenantSlug}
                  auth={auth}
                />
              ) : null}
            </div>
            <p className="mt-4 rounded-xl bg-card/80 p-3 text-sm text-foreground">{request.details}</p>
            <div className="mt-4 grid gap-2">
              {request.blocks.map((block) => <p key={`${block.label}-${block.start}`} className="rounded-xl bg-muted p-3 text-sm">{block.label}: {formatBlockTime(block, request.timezone)}</p>)}
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
            request.bookingNoticeMetadata?.violations.length ? (
              <Card>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold">Booking notice review</h2>
                  <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                    Additional approval
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2">
                  {request.bookingNoticeMetadata.violations.map((violation) => (
                    <p key={violation.type} className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                      {violation.message}
                    </p>
                  ))}
                </div>
                <div className="mt-3 grid gap-1 text-sm text-muted-foreground">
                  <p>Policy mode: <span className="font-medium text-foreground">{request.bookingNoticeMetadata.rules.violationMode}</span></p>
                  <p>Override acknowledged: <span className="font-medium text-foreground">{request.bookingNoticeMetadata.overrideAcknowledged ? "Yes" : "No"}</span></p>
                  {request.bookingNoticeMetadata.overriddenByRole ? (
                    <p>Overridden by role: <span className="font-medium text-foreground">{request.bookingNoticeMetadata.overriddenByRole}</span></p>
                  ) : null}
                  {request.bookingNoticeMetadata.overrideReason ? (
                    <p>Override reason: <span className="font-medium text-foreground">{request.bookingNoticeMetadata.overrideReason}</span></p>
                  ) : null}
                </div>
              </Card>
            ) : null
          ) : null}
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
                          {conflict.requestedQuantity !== undefined ? <div>Requested quantity: {conflict.requestedQuantity}</div> : null}
                          {conflict.availableQuantity !== undefined ? <div>Available quantity: {conflict.availableQuantity}</div> : null}
                          {conflict.missingQuantity !== undefined ? <div>Missing quantity: {conflict.missingQuantity}</div> : null}
                          {conflict.unavailableRooms?.length ? (
                            <div>
                              Unavailable rooms: {conflict.unavailableRooms.map((room) => `${room.code} (${room.reason})`).join(", ")}
                            </div>
                          ) : null}
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
