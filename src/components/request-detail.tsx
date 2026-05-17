"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Info,
  LoaderCircle,
  MessageSquare,
  Search,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { EmptyState, InlineError } from "@/components/app-state";
import { useOptionalDashboardAuth } from "@/components/dashboard-auth";
import { formFieldClass, primaryButtonClass } from "@/components/ui";
import { StatusBadge } from "@/components/admin/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatBlockTime, formatRequestDate, formatRooms } from "@/lib/format";
import {
  formatBookingDuration,
  occupancyDurationMinutes,
  sessionDurationMinutes,
} from "@/lib/booking-logic";
import { auditEventLabel } from "@/lib/audit-types";
import { friendlyErrorMessage } from "@/lib/errors";
import { useTenantLink } from "@/lib/use-tenant-link";

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

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

function titleCase(value: string) {
  return value.replace(/\w\S*/g, (word) => {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

function formatAuditEventLabel(eventType: string) {
  const labels: Record<string, string> = {
    "booking.created": "Booking Created",
    "booking.updated": "Booking Updated",
    "booking.status_changed": "Status Changed",
    "booking.approved": "Booking Approved",
    "booking.declined": "Booking Declined",
    "booking.cancelled": "Booking Cancelled",
    "booking.archived": "Booking Archived",
    "booking.deleted": "Booking Deleted",
    "booking.allocation_changed": "Allocation Changed",
    "booking.allocation_override": "Allocation Override",
    "booking.conflict_detected": "Conflict Detected",
    "booking.comment_added": "Comment Added",
    "booking.comment_edited": "Comment Edited",
    "booking.comment_deleted": "Comment Deleted",
    "blocked_time.created": "Blocked Time Created",
    "blocked_time.updated": "Blocked Time Updated",
    "blocked_time.deleted": "Blocked Time Deleted",
  };
  return labels[eventType] ?? titleCase(auditEventLabel(eventType));
}

function formatAllocationStatus(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "Not allocated";
  }
  const labels: Record<string, string> = {
    Unallocated: "Not allocated",
    AutoAllocated: "Auto-allocated",
    ManualReviewRequired: "Needs manual review",
    ManuallyAdjusted: "Manually adjusted",
    Conflict: "Conflict detected",
  };
  return labels[String(value)] ?? String(value);
}

function getRoomLabel(roomId: unknown, rooms?: RoomOption[]) {
  if (typeof roomId !== "string") return "Unknown room";
  const room = rooms?.find((item) => String(item._id) === roomId);
  if (!room) return "Unknown room";
  return room.code;
}

function formatRoomChip(room?: { code: string; name: string } | null) {
  if (!room) return "Unknown room";
  return `${room.name} (${room.code})`;
}

function toRoomIdArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function getRoomDiff(before: unknown, after: unknown, rooms?: RoomOption[]) {
  const beforeIds = new Set(toRoomIdArray(before));
  const afterIds = new Set(toRoomIdArray(after));
  const added = [...afterIds]
    .filter((roomId) => !beforeIds.has(roomId))
    .map((roomId) => getRoomLabel(roomId, rooms));
  const removed = [...beforeIds]
    .filter((roomId) => !afterIds.has(roomId))
    .map((roomId) => getRoomLabel(roomId, rooms));
  return { added, removed };
}

function humanFieldLabel(field: string) {
  const labels: Record<string, string> = {
    assignedRoomIds: "Rooms",
    allocationStatus: "Allocation status",
    allocationNotes: "Allocation notes",
    status: "Booking status",
  };
  return labels[field] ?? field;
}

function humanValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "None";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "None";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return "Updated";
  return String(value);
}

function formatAuditTime(value?: number) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function RequestDetailSkeleton() {
  return (
    <div className="grid gap-6" aria-label="Loading request">
      <header className="space-y-3">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </header>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-5">
          {[0, 1, 2].map((item) => (
            <Card key={item}>
              <CardHeader className="border-b pb-3">
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent className="grid gap-3 pt-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid content-start gap-5">
          <Card>
            <CardContent className="grid gap-3 pt-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function eventMetadata(event: TimelineEvent) {
  return event.metadata && typeof event.metadata === "object"
    ? (event.metadata as Record<string, unknown>)
    : {};
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  status:
    | "Pending"
    | "Approved"
    | "Confirmed"
    | "Completed"
    | "Declined"
    | "Cancelled";
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

type TimelineEvent = {
  _id: Id<"auditEvents">;
  eventType: string;
  message: string;
  actorName?: string;
  actorEmail?: string;
  createdAt: number;
  visibility: string;
  severity?: string;
  metadata?: unknown;
  diff?: Array<{ field: string; before: unknown; after: unknown }>;
};

type StatusAction =
  | "Approved"
  | "Declined"
  | "Cancelled"
  | "Pending"
  | "Completed";

// ---------------------------------------------------------------------------
// Diff components (preserved)
// ---------------------------------------------------------------------------

function AllocationChangeSummary({
  diff,
  rooms,
}: {
  diff: NonNullable<TimelineEvent["diff"]>;
  rooms?: RoomOption[];
}) {
  const roomEntry = diff.find((entry) => entry.field === "assignedRoomIds");
  const statusEntry = diff.find((entry) => entry.field === "allocationStatus");
  const roomChanges = roomEntry
    ? getRoomDiff(roomEntry.before, roomEntry.after, rooms)
    : { added: [], removed: [] };
  const statusChanged =
    statusEntry &&
    formatAllocationStatus(statusEntry.before) !==
      formatAllocationStatus(statusEntry.after);
  const summaryParts: string[] = [];
  if (roomChanges.added.length) {
    summaryParts.push(
      `${roomChanges.added.length} room${roomChanges.added.length === 1 ? "" : "s"} assigned`
    );
  }
  if (roomChanges.removed.length) {
    summaryParts.push(
      `${roomChanges.removed.length} room${roomChanges.removed.length === 1 ? "" : "s"} removed`
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-border bg-background p-3 text-sm">
      <p className="font-medium text-foreground">Room allocation updated</p>
      <div className="mt-1 text-muted-foreground">
        {summaryParts.length ? summaryParts.join(", ") : "Allocation updated"}
      </div>
      {statusChanged ? (
        <div className="text-muted-foreground">
          Status changed to {formatAllocationStatus(statusEntry.after)}
        </div>
      ) : null}
      {roomChanges.added.length || roomChanges.removed.length ? (
        <div className="mt-3 grid gap-1 rounded-md bg-muted/50 p-2 font-mono text-xs">
          {roomChanges.added.map((room, index) => (
            <div
              key={`added-${room}-${index}`}
              className="font-semibold text-green-700 dark:text-green-400"
            >
              +{room}
            </div>
          ))}
          {roomChanges.removed.map((room, index) => (
            <div
              key={`removed-${room}-${index}`}
              className="font-semibold text-red-700 dark:text-red-400"
            >
              -{room}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function GenericChangeSummary({
  diff,
}: {
  diff: NonNullable<TimelineEvent["diff"]>;
}) {
  return (
    <div className="mt-2 grid gap-2">
      {diff.map((entry) => (
        <div
          key={entry.field}
          className="rounded-lg border border-border bg-background p-3 text-sm"
        >
          <p className="font-medium text-foreground">
            {humanFieldLabel(entry.field)}
          </p>
          <p className="mt-1 text-muted-foreground">
            {humanValue(entry.before)} &rarr;{" "}
            <span className="text-foreground">{humanValue(entry.after)}</span>
          </p>
        </div>
      ))}
    </div>
  );
}

function TimelineDetails({
  event,
  rooms,
}: {
  event: TimelineEvent;
  rooms?: RoomOption[];
}) {
  const [open, setOpen] = useState(false);
  const metadata = eventMetadata(event);
  const bodyMarkdown =
    typeof metadata.bodyMarkdown === "string" ? metadata.bodyMarkdown : null;
  const hasDiff = Boolean(event.diff?.length);
  const hasRawMeta =
    !bodyMarkdown && !hasDiff && Object.keys(metadata).length > 0;

  return (
    <>
      {bodyMarkdown ? (
        <p className="mt-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
          {bodyMarkdown}
        </p>
      ) : null}

      {hasDiff ? (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-expanded={open}
          >
            {open ? (
              <ChevronUp className="size-3" />
            ) : (
              <ChevronDown className="size-3" />
            )}
            {open ? "Hide" : "View"} changes
          </button>
          {open ? (
            event.eventType === "booking.allocation_changed" ? (
              <AllocationChangeSummary diff={event.diff!} rooms={rooms} />
            ) : (
              <GenericChangeSummary diff={event.diff!} />
            )
          ) : null}
        </div>
      ) : null}

      {hasRawMeta ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            Details
          </summary>
          <code className="mt-1 block overflow-auto rounded bg-muted p-2 text-xs text-muted-foreground">
            {JSON.stringify(metadata)}
          </code>
        </details>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Manual allocation panel
// ---------------------------------------------------------------------------

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

  const hasAllocatedRooms = (request.assignedRoomIds ?? []).length > 0;
  const [isEditingAllocation, setIsEditingAllocation] = useState(
    !hasAllocatedRooms
  );

  const selectedRoomIdSet = useMemo(
    () => new Set<string>(selectedRoomIds.map(String)),
    [selectedRoomIds]
  );

  const preview = useQuery(
    api.bookings.previewManualAllocation,
    isEditingAllocation
      ? {
          tenantSlug,
          auth,
          requestId: request._id,
          assignedRoomIds: selectedRoomIds,
        }
      : "skip"
  );

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
      toast.success("Room allocation saved.");
      setIsEditingAllocation(false);
    } catch (caught) {
      const message = friendlyErrorMessage(caught, "Unable to save allocation.");
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">
            Allocation management
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {request.allocationUpdatedBy?.name
              ? `Last updated by ${request.allocationUpdatedBy.name}`
              : "Not yet updated"}{" "}
            &middot; {formatAuditTime(request.allocationUpdatedAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {formatAllocationStatus(request.allocationStatus)}
          </Badge>
          {hasAllocatedRooms && !isEditingAllocation ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditingAllocation(true)}
            >
              Edit allocation
            </Button>
          ) : null}
        </div>
      </div>

      {/* Current rooms */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {selectedRooms.map((room, index) =>
          room ? (
            isEditingAllocation ? (
              <button
                key={room._id}
                type="button"
                onClick={() => toggleRoom(room._id)}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive"
                aria-label={`Remove ${formatRoomChip(room)}`}
              >
                {formatRoomChip(room)} <X className="size-3" aria-hidden />
              </button>
            ) : (
              <Badge key={room._id} variant="outline" className="text-xs">
                {formatRoomChip(room)}
              </Badge>
            )
          ) : (
            <Badge key={`${selectedRoomIds[index]}-${index}`} variant="outline" className="text-xs">
              Unknown room
            </Badge>
          )
        )}
        {selectedRooms.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No rooms assigned yet.
          </p>
        ) : null}
      </div>

      {isEditingAllocation ? (
        <div className="mt-4 grid gap-3">
          {/* Room search */}
          <div>
            <label
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
              htmlFor="room-search"
            >
              Search rooms
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="room-search"
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
                className="pl-8 text-sm"
                placeholder="Name, code, type, or campus"
              />
            </div>

            <div className="mt-2 grid max-h-56 gap-1.5 overflow-auto rounded-lg border border-border bg-background p-2">
              {filteredRooms.map((room) => {
                const selected = selectedRoomIdSet.has(String(room._id));
                return (
                  <button
                    key={room._id}
                    type="button"
                    onClick={() => toggleRoom(room._id)}
                    className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                      selected
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-transparent bg-muted/30 text-foreground hover:bg-muted"
                    }`}
                  >
                    <span className="block break-words font-medium">{formatRoomChip(room)}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground sm:ml-2 sm:mt-0 sm:inline">
                      {room.roomType?.name ?? "Unknown type"} &middot;{" "}
                      {room.campus?.name ?? "No campus"} &middot; cap{" "}
                      {room.capacity}
                      {room.active ? "" : " (inactive)"}
                    </span>
                  </button>
                );
              })}
              {rooms === undefined ? (
                <div className="grid gap-2 p-1">
                  {[0, 1, 2].map((item) => (
                    <Skeleton key={item} className="h-9 rounded-lg" />
                  ))}
                </div>
              ) : null}
              {rooms !== undefined && filteredRooms.length === 0 ? (
                <p className="px-2 py-1 text-sm text-muted-foreground">
                  No rooms match that search.
                </p>
              ) : null}
            </div>
          </div>

          {/* Allocation notes */}
          <div>
            <label
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
              htmlFor="allocation-notes"
            >
              Allocation notes
            </label>
            <Textarea
              id="allocation-notes"
              value={notes}
              onChange={(event) => setNotes(event.currentTarget.value)}
              placeholder="E.g. Moved due to maintenance"
              className="min-h-20 text-sm"
            />
          </div>

          {/* Preview conflicts */}
          <div className="grid gap-2">
            {preview === undefined ? (
              <p className="rounded-lg border border-border bg-muted/30 p-2.5 text-xs text-muted-foreground">
                Checking selected rooms for conflicts...
              </p>
            ) : preview.conflicts.length ? (
              preview.conflicts.map((conflict, index) => (
                <div
                  key={`${conflict.type}-${index}`}
                  className={`rounded-lg border p-2.5 text-sm ${severityClass(conflict.severity)}`}
                  role="alert"
                >
                  <div className="flex gap-2">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <div>
                      <p className="font-medium">{conflict.message}</p>
                      {conflict.roomCode ? (
                        <p className="mt-0.5 text-xs opacity-80">
                          Room: {conflict.roomCode}
                        </p>
                      ) : null}
                      {conflict.blockedReason ? (
                        <p className="text-xs opacity-80">
                          Blocked: {conflict.blockedReason}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-primary/30 bg-primary/10 p-2.5 text-xs text-primary">
                No conflicts detected for this selection.
              </p>
            )}
          </div>

          {error ? (
            <InlineError message={error} />
          ) : null}

          <div className="sticky bottom-0 z-10 -mx-4 -mb-4 flex flex-col gap-2 border-t border-border bg-card/95 p-3 backdrop-blur sm:static sm:m-0 sm:flex-row sm:flex-wrap sm:border-0 sm:bg-transparent sm:p-0">
            <Button
              type="button"
              onClick={save}
              disabled={!hasChanges || saving}
              size="sm"
              className="w-full sm:w-auto"
            >
              {saving ? (
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
              ) : null}
              Save allocation
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                reset();
                setIsEditingAllocation(!hasAllocatedRooms);
              }}
              disabled={saving}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible card wrapper
// ---------------------------------------------------------------------------

function CollapsibleCard({
  title,
  icon: Icon,
  badge,
  defaultOpen = true,
  className,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className={className}>
        <CollapsibleTrigger className="w-full text-left">
          <CardHeader className="border-b pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                {Icon ? (
                  <Icon className="size-4 text-muted-foreground" aria-hidden />
                ) : null}
                {title}
              </CardTitle>
              <div className="flex items-center gap-2">
                {badge}
                {open ? (
                  <ChevronUp className="size-4 text-muted-foreground" aria-hidden />
                ) : (
                  <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-4">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// Activity timeline
// ---------------------------------------------------------------------------

function ActivityTimelineCard({
  events,
  rooms,
}: {
  events?: TimelineEvent[];
  rooms?: RoomOption[];
}) {
  const eventCount = events?.length ?? 0;

  return (
    <CollapsibleCard
      title="Activity timeline"
      icon={Clock}
      defaultOpen={false}
      badge={
        events !== undefined ? (
          <Badge variant="outline" className="text-xs">
            {eventCount} {eventCount === 1 ? "event" : "events"}
          </Badge>
        ) : null
      }
    >
      {events === undefined ? (
        <div className="grid gap-3" aria-label="Loading activity">
          {[0, 1, 2].map((item) => (
            <div key={item} className="flex gap-3">
              <Skeleton className="size-6 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No activity recorded yet.
        </p>
      ) : (
        <ol className="relative border-l border-border pl-5">
          {events.map((event, idx) => {
            const isComment = event.eventType.includes("comment");
            return (
              <li
                key={event._id}
                className={`relative pb-5 ${idx === events.length - 1 ? "pb-0" : ""}`}
              >
                {/* dot */}
                <span
                  className="absolute -left-[1.3125rem] flex size-6 items-center justify-center rounded-full border border-border bg-card"
                  aria-hidden
                >
                  {isComment ? (
                    <MessageSquare className="size-3 text-muted-foreground" />
                  ) : (
                    <Clock className="size-3 text-muted-foreground" />
                  )}
                </span>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-foreground">
                      {formatAuditEventLabel(event.eventType)}
                    </span>
                    <time
                      className="text-xs text-muted-foreground"
                      dateTime={new Date(event.createdAt).toISOString()}
                    >
                      {formatAuditTime(event.createdAt)}
                    </time>
                  </div>

                  <p className="mt-1 text-sm font-medium text-foreground">
                    {event.eventType === "booking.allocation_changed"
                      ? "Room allocation updated"
                      : event.message}
                  </p>

                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {event.actorName ?? "System"}
                    {event.actorEmail ? ` \u00b7 ${event.actorEmail}` : ""}
                  </p>

                  <TimelineDetails event={event} rooms={rooms} />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </CollapsibleCard>
  );
}

function SubmissionConfirmation({
  request,
  contactEmail,
  isLoggedIn,
  linkFor,
}: {
  request: {
    _id: string;
    status: string;
    sessionName: string;
    requesterEmail: string;
    timezone?: string;
    blocks: Array<{ label?: string; start: string; end: string }>;
    roomSelectionMode?: "SpecificRooms" | "RoomTypeQuantity";
    assignedRooms?: Array<{ name: string; code?: string }>;
    requestedRooms?: Array<{ name: string; code?: string }>;
    roomTypeRequestDetails?: Array<{ roomTypeName: string; quantity: number }>;
    roomTypeRequests?: Array<{ quantity: number }>;
  };
  contactEmail: string;
  isLoggedIn: boolean;
  linkFor: (path: string) => string;
}) {
  const sessionBlock = request.blocks.find((block) => block.label === "Session") ?? request.blocks[0];
  const roomSummary = formatRooms({
    roomSelectionMode: request.roomSelectionMode,
    requestedRooms: request.requestedRooms,
    roomTypeRequestDetails: request.roomTypeRequestDetails,
    roomTypeRequests: request.roomTypeRequests,
  });

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <Card className="border-primary/25 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <CheckCircle className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Request received
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
                Your request has been submitted.
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                This request is pending review and is not yet approved. Staff will review the details before confirming whether the booking can go ahead.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle className="text-sm font-semibold">Submission details</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Reference ID</dt>
              <dd className="mt-1 break-all font-mono text-sm text-foreground">{request._id}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Status</dt>
              <dd className="mt-1"><StatusBadge status={request.status} /></dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Session</dt>
              <dd className="mt-1 text-sm font-medium text-foreground">{request.sessionName}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Session date/time</dt>
              <dd className="mt-1 text-sm text-foreground">
                {sessionBlock ? formatBlockTime(sessionBlock, request.timezone) : "Not provided"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-muted-foreground">Requested rooms</dt>
              <dd className="mt-1 text-sm text-foreground">{roomSummary}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-3 pt-4 text-sm text-muted-foreground">
          <p>
            Need to change anything? Contact{" "}
            <a className="font-medium text-primary hover:underline" href={`mailto:${contactEmail}`}>
              {contactEmail}
            </a>
            .
          </p>
          <p>
            To view bookings linked to this email address, create an account using the same email you used for this request.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {isLoggedIn ? (
              <Link href={linkFor("/dashboard")} className={primaryButtonClass}>
                View my bookings
              </Link>
            ) : null}
            <Link href={linkFor(`/requests/${request._id}?email=${encodeURIComponent(request.requesterEmail)}`)} className={primaryButtonClass}>
              Open tracking page
            </Link>
            <Link href={`/auth/sign-in?returnTo=${encodeURIComponent(linkFor("/dashboard"))}`} className="inline-flex items-center rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50">
              Sign in or create account
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main RequestDetail component
// ---------------------------------------------------------------------------

export function RequestDetail({
  id,
  tenantSlug: publicTenantSlug,
  publicView = false,
}: {
  id: string;
  tenantSlug?: string;
  publicView?: boolean;
}) {
  const auth = useOptionalDashboardAuth();
  const linkFor = useTenantLink(auth?.tenantSlug);
  const searchParams = useSearchParams();
  const emailFromUrl = searchParams.get("email")?.trim() ?? "";
  const isSubmissionConfirmation = publicView && searchParams.get("submitted") === "1";
  const tenantSlug = publicView ? (publicTenantSlug ?? "") : (auth?.tenantSlug ?? "");

  // Role-based access
  const isStaffOrAbove =
    auth?.role === "Developer" ||
    auth?.role === "Admin" ||
    auth?.role === "Staff";

  const updateStatus = useMutation(api.bookings.updateStatus);
  const addComment = useMutation(api.bookings.addComment);
  const tenant = useQuery(
    api.tenants.getBySlug,
    tenantSlug ? { slug: tenantSlug } : "skip"
  );

  const [statusBusy, setStatusBusy] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const [overrideAction, setOverrideAction] = useState<{
    status: "Approved" | "Completed";
    title: string;
    description: string;
    overrideType: "conflict" | "completed";
  } | null>(null);
  const [reasonAction, setReasonAction] = useState<{
    status: "Declined" | "Cancelled";
    title: string;
    description: string;
  } | null>(null);
  const [statusReason, setStatusReason] = useState("");

  const publicLookupArgs =
    publicView && emailFromUrl
      ? {
          tenantSlug,
          requestId: id as Id<"bookingRequests">,
          requesterEmail: emailFromUrl,
        }
      : "skip";

  const request = useQuery(
    publicView
      ? api.bookings.getPublicRequestByReference
      : api.bookings.getRequest,
    publicView
      ? publicLookupArgs
      : {
          tenantSlug,
          auth: auth ?? {},
          requestId: id as Id<"bookingRequests">,
        }
  );

  const timeline = useQuery(
    publicView ? api.audit.listPublicForBooking : api.audit.listForBooking,
    publicView
      ? emailFromUrl
        ? {
            tenantSlug,
            bookingId: id as Id<"bookingRequests">,
            requesterEmail: emailFromUrl,
          }
        : "skip"
      : auth
        ? { tenantSlug, auth, bookingId: id as Id<"bookingRequests"> }
        : "skip"
  );

  const rooms = useQuery(
    api.tenants.listPrivateRooms,
    publicView || !auth ? "skip" : { tenantSlug, auth, activeOnly: false }
  );

  async function runStatusUpdate(args: {
    status: StatusAction;
    reason?: string;
    allowConflictOverride?: boolean;
    allowCompletedOverride?: boolean;
  }) {
    if (!request) return;
    setStatusBusy(true);
    try {
      await updateStatus({
        tenantSlug,
        auth: auth ?? {},
        requestId: request._id,
        status: args.status,
        reason: args.reason,
        allowConflictOverride: args.allowConflictOverride,
        allowCompletedOverride: args.allowCompletedOverride,
      });
      toast.success(`Booking moved to ${args.status.toLowerCase()}.`);
    } catch (caught) {
      toast.error(friendlyErrorMessage(caught, "Unable to update booking status."));
    } finally {
      setStatusBusy(false);
    }
  }

  function hasBlockingConflicts() {
    return (
      request?.conflictMetadata?.conflicts?.some(
        (conflict) => conflict.severity === "likely_unavailable"
      ) ?? false
    );
  }

  function bookingHasEnded() {
    if (!request?.blocks?.length) return false;
    const latestEnd = Math.max(
      ...request.blocks.map((block) => Date.parse(block.end))
    );
    return Number.isFinite(latestEnd) && latestEnd <= Date.now();
  }

  function approveBooking() {
    if (!request) return;
    const assignedRooms = request.assignedRoomIds ?? [];
    if (assignedRooms.length === 0) {
      toast.error("Assign at least one room before approving this booking.");
      return;
    }
    if (hasBlockingConflicts()) {
      setOverrideAction({
        status: "Approved",
        title: "Approve with room conflict?",
        description:
          "This booking has blocking room conflicts and may double-book a room. Approve only if you are intentionally overriding the conflict warning.",
        overrideType: "conflict",
      });
      return;
    }
    void runStatusUpdate({ status: "Approved" });
  }

  function completeBooking() {
    if (!request) return;
    if (!bookingHasEnded()) {
      setOverrideAction({
        status: "Completed",
        title: "Complete before booking end time?",
        description:
          "This booking has not ended yet. Mark it as completed only if this is an intentional staff override.",
        overrideType: "completed",
      });
      return;
    }
    void runStatusUpdate({ status: "Completed" });
  }

  function openReasonDialog(status: "Declined" | "Cancelled") {
    setStatusReason("");
    setReasonAction({
      status,
      title: status === "Declined" ? "Decline booking" : "Cancel booking",
      description:
        "You can add an optional reason or comment. This will be saved in the booking activity timeline.",
    });
  }

  async function onComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const bodyMarkdown = String(
      new FormData(form).get("comment") ?? ""
    ).trim();
    if (!bodyMarkdown) return;
    setCommentBusy(true);
    try {
      await addComment({
        tenantSlug,
        auth: auth ?? {},
        requestId: id as Id<"bookingRequests">,
        bodyMarkdown,
        internal: !publicView,
      });
      toast.success("Comment added.");
      form.reset();
    } catch (caught) {
      toast.error(friendlyErrorMessage(caught, "Unable to add comment."));
    } finally {
      setCommentBusy(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Public view — email gate
  // ---------------------------------------------------------------------------

  if (publicView && !emailFromUrl) {
    return (
      <div className="grid gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Requester tracking
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            Access booking request
          </h1>
        </div>
        <Card>
          <CardContent className="pt-4">
            <form
              method="get"
              className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end"
            >
              <label>
                <span className="text-sm font-medium text-foreground">
                  Requester email
                </span>
                <input
                  name="email"
                  type="email"
                  required
                  className={formFieldClass}
                />
              </label>
              <button className={primaryButtonClass}>View request</button>
            </form>
            <p className="mt-3 text-sm text-muted-foreground">
              Use the booking reference in the URL and the email address used
              when submitting the request.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Loading / not found states
  // ---------------------------------------------------------------------------

  if (request === undefined) {
    return <RequestDetailSkeleton />;
  }

  if (!request) {
    return (
      <EmptyState
        icon={FileText}
        title="Request not found"
        message={
          publicView
            ? "Check that the booking link and requester email are correct."
            : "This request may have been removed, or your account may not have access to it."
        }
        action={{ label: publicView ? "Back to booking form" : "Back to requests", href: publicView ? "/book" : "/dashboard/requests" }}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const sessionLength = sessionDurationMinutes(request.blocks);
  const occupancyLength = occupancyDurationMinutes(request.blocks);
  const hasConflicts = Boolean(
    request.conflictMetadata?.conflicts?.length
  );
  const hasBlockingConflict = hasBlockingConflicts();
  const sessionBlock = request.blocks.find(
    (b: { label?: string }) => b.label === "Session"
  ) ?? request.blocks[0];

  if (isSubmissionConfirmation) {
    return (
      <SubmissionConfirmation
        request={request}
        contactEmail={tenant?.contactEmail ?? "simulation@example.edu"}
        isLoggedIn={Boolean(auth)}
        linkFor={linkFor}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // Page render
  // ---------------------------------------------------------------------------

  return (
    <div className="grid gap-6">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <header>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {!publicView ? (
                <p className="text-xs font-mono text-muted-foreground">
                  {request._id}
                </p>
              ) : null}
              <StatusBadge status={request.status} />
              {hasBlockingConflict && !publicView ? (
                <Badge
                  variant="outline"
                  className="border-destructive/35 bg-destructive/10 text-destructive text-xs"
                >
                  <AlertTriangle className="size-3" aria-hidden />
                  Conflicts
                </Badge>
              ) : null}
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground text-balance sm:text-3xl">
              {request.sessionName}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <User className="size-3.5" aria-hidden />
                {request.requesterName}
              </span>
              {sessionBlock ? (
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-3.5" aria-hidden />
                  {formatRequestDate(request)}
                </span>
              ) : null}
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5" aria-hidden />
                {sessionLength !== null
                  ? formatBookingDuration(sessionLength)
                  : "Unknown duration"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Booking notice violations (staff/admin only)                        */}
      {/* ------------------------------------------------------------------ */}
      {!publicView && request.bookingNoticeMetadata?.violations.length ? (
        <div
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  Booking notice review required
                </p>
                <Badge
                  variant="outline"
                  className="border-amber-300 bg-amber-100 text-amber-900 text-xs dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200"
                >
                  Additional approval
                </Badge>
              </div>
              <ul className="mt-2 grid gap-1">
                {request.bookingNoticeMetadata.violations.map((violation) => (
                  <li
                    key={violation.type}
                    className="text-sm text-amber-800 dark:text-amber-300"
                  >
                    {violation.message}
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-amber-700 dark:text-amber-400">
                <span>
                  Policy mode:{" "}
                  <strong className="text-amber-900 dark:text-amber-200">
                    {request.bookingNoticeMetadata.rules.violationMode}
                  </strong>
                </span>
                <span>
                  Override acknowledged:{" "}
                  <strong className="text-amber-900 dark:text-amber-200">
                    {request.bookingNoticeMetadata.overrideAcknowledged
                      ? "Yes"
                      : "No"}
                  </strong>
                </span>
                {request.bookingNoticeMetadata.overriddenByRole ? (
                  <span>
                    Overridden by:{" "}
                    <strong className="text-amber-900 dark:text-amber-200">
                      {request.bookingNoticeMetadata.overriddenByRole}
                    </strong>
                  </span>
                ) : null}
                {request.bookingNoticeMetadata.overrideReason ? (
                  <span>
                    Reason:{" "}
                    <strong className="text-amber-900 dark:text-amber-200">
                      {request.bookingNoticeMetadata.overrideReason}
                    </strong>
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* Two-column layout                                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* ================================================================ */}
        {/* Main column                                                        */}
        {/* ================================================================ */}
        <div className="order-2 grid min-w-0 content-start gap-5 xl:order-1">
          {/* -------------------------------------------------------------- */}
          {/* Booking overview                                                 */}
          {/* -------------------------------------------------------------- */}
          <CollapsibleCard title="Booking overview" icon={Info} defaultOpen={true}>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs font-medium text-muted-foreground">
                  Requester
                </dt>
                <dd className="mt-1 text-sm font-medium text-foreground">
                  {request.requesterName}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">
                  Email
                </dt>
                <dd className="mt-1 break-words text-sm text-foreground">
                  {request.requesterEmail}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">
                  Phone
                </dt>
                <dd className="mt-1 break-words text-sm text-foreground">
                  {request.requesterPhone || (
                    <span className="italic text-muted-foreground">
                      Not provided
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">
                  Attendees
                </dt>
                <dd className="mt-1 text-sm font-medium text-foreground">
                  {request.attendeeCount}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">
                  CC emails
                </dt>
                <dd className="mt-1 break-words text-sm text-foreground">
                  {request.ccEmails.length ? (
                    request.ccEmails.join(", ")
                  ) : (
                    <span className="italic text-muted-foreground">None</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">
                  Session duration
                </dt>
                <dd className="mt-1 text-sm font-medium text-foreground">
                  {sessionLength !== null
                    ? formatBookingDuration(sessionLength)
                    : "Invalid"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">
                  Reserved room time
                </dt>
                <dd className="mt-1 text-sm font-medium text-foreground">
                  {occupancyLength !== null
                    ? formatBookingDuration(occupancyLength)
                    : "Invalid"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">
                  Room request mode
                </dt>
                <dd className="mt-1 text-sm font-medium text-foreground">
                  {request.roomSelectionMode === "SpecificRooms"
                    ? "Specific rooms"
                    : "Room type quantity"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">
                  Rooms
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  {formatRooms(request)}
                </dd>
              </div>
            </dl>

            {/* Details / notes */}
            {request.details ? (
              <>
                <Separator className="my-4" />
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                    Additional details
                  </p>
                  <p className="break-words rounded-lg bg-muted/50 px-3 py-2.5 text-sm leading-relaxed text-foreground">
                    {request.details}
                  </p>
                </div>
              </>
            ) : null}
          </CollapsibleCard>

          {/* -------------------------------------------------------------- */}
          {/* Session timings                                                  */}
          {/* -------------------------------------------------------------- */}
          <CollapsibleCard title="Session timings" icon={CalendarDays} defaultOpen={true}>
            <ol className="grid gap-2">
              {request.blocks.map(
                (block: { label?: string; start: string; end: string }) => (
                  <li
                    key={`${block.label}-${block.start}`}
                    className="flex flex-col gap-1 rounded-lg bg-muted/40 px-3 py-2.5 text-sm sm:flex-row sm:items-start sm:gap-3"
                  >
                    <span className="mt-0.5 min-w-[4.5rem] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {block.label ?? "Block"}
                    </span>
                    <span className="break-words font-medium text-foreground">
                      {formatBlockTime(block, request.timezone)}
                    </span>
                  </li>
                )
              )}
            </ol>
          </CollapsibleCard>

          {/* -------------------------------------------------------------- */}
          {/* Room requests + allocation                                       */}
          {/* -------------------------------------------------------------- */}
          <CollapsibleCard
            title="Room allocation"
            icon={Search}
            defaultOpen={!(request.assignedRoomIds?.length ?? 0)}
            badge={
              <Badge variant="outline" className="text-xs font-normal">
                {formatAllocationStatus(request.allocationStatus)}
              </Badge>
            }
          >
            <div className="grid gap-3">
              {/* Specific rooms requested */}
              {request.requestedRooms?.length ? (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Requested rooms
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {request.requestedRooms.map(
                      (room: { _id: string; name: string; code: string; capacity: number }) => (
                        <Badge key={room._id} variant="outline" className="text-xs">
                          {room.name} ({room.code}) &middot; cap {room.capacity}
                        </Badge>
                      )
                    )}
                  </div>
                </div>
              ) : null}

              {/* Room type quantities requested */}
              {request.roomTypeRequestDetails?.length ? (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Requested room types
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {request.roomTypeRequestDetails.map(
                      (item: { roomTypeId: string; quantity: number; roomTypeName: string; defaultCapacity: number }) => (
                        <Badge key={item.roomTypeId} variant="outline" className="text-xs">
                          {item.quantity}&times;{" "}
                          {item.roomTypeName}
                          {item.quantity === 1 ? "" : "s"} &middot; ~
                          {item.quantity * item.defaultCapacity} cap
                        </Badge>
                      )
                    )}
                  </div>
                </div>
              ) : null}

              {/* Assigned rooms (read-only view for non-staff) */}
              {!isStaffOrAbove &&
              (request.assignedRooms?.length ||
                request.assignedRoomIds?.length) ? (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Assigned rooms
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(request.assignedRooms ?? []).map(
                      (room: { _id: string; code: string; name: string }) => (
                        <Badge key={room._id} variant="outline" className="text-xs">
                          {formatRoomChip(room)}
                        </Badge>
                      )
                    )}
                  </div>
                </div>
              ) : null}

              {/* No rooms state (non-staff) */}
              {!isStaffOrAbove &&
              !request.requestedRooms?.length &&
              !request.roomTypeRequestDetails?.length &&
              !request.assignedRooms?.length ? (
                <p className="text-sm italic text-muted-foreground">
                  No room information available.
                </p>
              ) : null}
            </div>

            {/* Staff/admin: allocation management panel */}
            {!publicView && auth && isStaffOrAbove ? (
              <ManualAllocationPanel
                key={`${request._id}-${request.updatedAt}`}
                request={request}
                rooms={rooms}
                tenantSlug={tenantSlug}
                auth={auth}
              />
            ) : null}
          </CollapsibleCard>

          {/* -------------------------------------------------------------- */}
          {/* Custom form inputs                                               */}
          {/* -------------------------------------------------------------- */}
          {request.customInputs.length > 0 ? (
            <CollapsibleCard title="Custom form inputs" defaultOpen={true}>
              <dl className="grid gap-3 sm:grid-cols-2">
                {request.customInputs.map(
                  (field: { fieldId: string; label: string; value: unknown }) => (
                    <div key={field.fieldId}>
                      <dt className="text-xs font-medium text-muted-foreground">
                        {field.label}
                      </dt>
                      <dd className="mt-1 break-words text-sm text-foreground">
                        {field.value !== null &&
                        field.value !== undefined &&
                        String(field.value) !== "" ? (
                          String(field.value)
                        ) : (
                          <span className="italic text-muted-foreground">
                            Not provided
                          </span>
                        )}
                      </dd>
                    </div>
                  )
                )}
              </dl>
            </CollapsibleCard>
          ) : null}

          {/* -------------------------------------------------------------- */}
          {/* Comments                                                         */}
          {/* -------------------------------------------------------------- */}
          <CollapsibleCard
            title="Comments"
            icon={MessageSquare}
            defaultOpen={true}
            badge={
              request.comments.length > 0 ? (
                <Badge variant="outline" className="text-xs">
                  {request.comments.length}
                </Badge>
              ) : null
            }
          >
            {request.comments.length > 0 ? (
              <ol className="grid gap-3">
                {request.comments.map(
                  (comment: {
                    _id: string;
                    bodyMarkdown: string;
                    authorName?: string;
                    createdAt: number;
                    editedAt?: number;
                  }) => (
                    <li
                      key={comment._id}
                      className="rounded-xl border border-border bg-muted/30 p-4"
                    >
                      <p className="break-words text-sm leading-relaxed text-foreground">
                        {comment.bodyMarkdown}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium">
                          {comment.authorName ?? "Unknown"}
                        </span>
                        <span aria-hidden>&middot;</span>
                        <time
                          dateTime={new Date(comment.createdAt).toISOString()}
                        >
                          {formatAuditTime(comment.createdAt)}
                        </time>
                        {comment.editedAt ? (
                          <>
                            <span aria-hidden>&middot;</span>
                            <span>
                              edited{" "}
                              <time
                                dateTime={new Date(
                                  comment.editedAt
                                ).toISOString()}
                              >
                                {formatAuditTime(comment.editedAt)}
                              </time>
                            </span>
                          </>
                        ) : null}
                      </div>
                    </li>
                  )
                )}
              </ol>
            ) : (
              <p className="text-sm italic text-muted-foreground">
                No comments yet.
              </p>
            )}

            {!publicView ? (
              <>
                {request.comments.length > 0 ? (
                  <Separator className="my-4" />
                ) : null}
                <form onSubmit={onComment} className="grid gap-3">
                  <label htmlFor="comment-body" className="sr-only">
                    Add a comment
                  </label>
                  <Textarea
                    id="comment-body"
                    name="comment"
                    placeholder="Add a comment..."
                    className="min-h-24 text-sm"
                    disabled={commentBusy}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={commentBusy}
                    >
                      {commentBusy ? (
                        <LoaderCircle
                          className="size-3.5 animate-spin"
                          aria-hidden
                        />
                      ) : (
                        <MessageSquare className="size-3.5" aria-hidden />
                      )}
                      Add comment
                    </Button>
                  </div>
                </form>
              </>
            ) : null}
          </CollapsibleCard>

          {/* -------------------------------------------------------------- */}
          {/* Activity timeline                                                */}
          {/* -------------------------------------------------------------- */}
          <ActivityTimelineCard
            events={timeline as TimelineEvent[] | undefined}
            rooms={rooms}
          />
        </div>

        {/* ================================================================ */}
        {/* Sidebar column                                                     */}
        {/* ================================================================ */}
        <div className="order-1 grid min-w-0 content-start gap-5 xl:order-2">
          {/* -------------------------------------------------------------- */}
          {/* Workflow actions — staff/admin/developer only                    */}
          {/* -------------------------------------------------------------- */}
          {!publicView && isStaffOrAbove ? (
            <CollapsibleCard title="Workflow actions" defaultOpen={true} className="xl:sticky xl:top-24">
              {hasConflicts ? (
                <div
                  className="mb-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
                  role="alert"
                >
                  <AlertTriangle
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden
                  />
                  <p>
                    Availability warnings detected. Approval may require a
                    staff override.
                  </p>
                </div>
              ) : null}

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        onClick={approveBooking}
                        disabled={statusBusy}
                        className="w-full"
                      >
                        {statusBusy ? (
                          <LoaderCircle
                            className="size-4 animate-spin"
                            aria-hidden
                          />
                        ) : (
                          <CheckCircle className="size-4" aria-hidden />
                        )}
                        Approve
                      </Button>
                    }
                  />
                  <TooltipContent side="left">
                    Approve and confirm the booking. A room must be assigned
                    first.
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => openReasonDialog("Declined")}
                        disabled={statusBusy}
                        className="w-full"
                      >
                        Decline
                      </Button>
                    }
                  />
                  <TooltipContent side="left">
                    Decline this booking request with an optional reason.
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => openReasonDialog("Cancelled")}
                        disabled={statusBusy}
                        className="w-full"
                      >
                        Cancel
                      </Button>
                    }
                  />
                  <TooltipContent side="left">
                    Cancel this booking with an optional reason.
                  </TooltipContent>
                </Tooltip>

                <Separator className="sm:col-span-2 xl:col-span-1" />

                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          void runStatusUpdate({ status: "Pending" })
                        }
                        disabled={statusBusy}
                        className="w-full"
                      >
                        Move to Pending
                      </Button>
                    }
                  />
                  <TooltipContent side="left">
                    Return the booking to Pending for further review.
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        onClick={completeBooking}
                        disabled={statusBusy}
                        className="w-full"
                      >
                        Mark Completed
                      </Button>
                    }
                  />
                  <TooltipContent side="left">
                    Mark as completed. Requires a staff override if the
                    booking has not yet ended.
                  </TooltipContent>
                </Tooltip>
              </div>
            </CollapsibleCard>
          ) : null}

          {/* -------------------------------------------------------------- */}
          {/* Availability conflicts (staff/admin only)                       */}
          {/* -------------------------------------------------------------- */}
          {!publicView ? (
            <CollapsibleCard
              title="Availability"
              defaultOpen={true}
              badge={
                request.conflictMetadata?.highestSeverity ? (
                  <Badge
                    variant="outline"
                    className={`text-xs ${severityClass(request.conflictMetadata.highestSeverity)}`}
                  >
                    {severityLabel(
                      request.conflictMetadata.highestSeverity
                    )}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-primary/30 bg-primary/10 text-primary text-xs"
                  >
                    Clear
                  </Badge>
                )
              }
            >
              {request.conflictMetadata?.summary ? (
                <p className="mb-3 text-sm text-muted-foreground">
                  {request.conflictMetadata.summary}
                </p>
              ) : null}

              {request.conflictMetadata?.conflicts.length ? (
                <div className="grid gap-2" role="list" aria-label="Conflicts">
                  {request.conflictMetadata.conflicts.map(
                    (conflict: {
                      type: string;
                      severity: string;
                      message: string;
                      roomCode?: string;
                      roomName?: string;
                      roomTypeName?: string;
                      campusName?: string;
                      blockedReason?: string;
                      conflictingRequestId?: string;
                      requestedQuantity?: number;
                      availableQuantity?: number;
                      missingQuantity?: number;
                      unavailableRooms?: Array<{ code: string; reason: string }>;
                    }, index: number) => (
                      <div
                        key={`${conflict.type}-${index}`}
                        className={`rounded-xl border p-3 text-sm ${severityClass(conflict.severity)}`}
                        role="listitem"
                      >
                        <div className="flex items-start gap-2">
                          {conflict.severity === "informational" ? (
                            <Info
                              className="mt-0.5 size-4 shrink-0"
                              aria-hidden
                            />
                          ) : (
                            <AlertTriangle
                              className="mt-0.5 size-4 shrink-0"
                              aria-hidden
                            />
                          )}
                          <div className="min-w-0">
                            <p className="font-medium">
                              {conflict.message}
                            </p>
                            <dl className="mt-2 grid gap-0.5 text-xs opacity-85">
                              <div>
                                <dt className="sr-only">Type</dt>
                                <dd>Type: {conflict.type}</dd>
                              </div>
                              {conflict.roomCode ? (
                                <div>
                                  <dt className="sr-only">Room</dt>
                                  <dd>
                                    Room: {conflict.roomCode}{" "}
                                    {conflict.roomName
                                      ? `(${conflict.roomName})`
                                      : ""}
                                  </dd>
                                </div>
                              ) : null}
                              {conflict.roomTypeName ? (
                                <div>
                                  <dt className="sr-only">Room type</dt>
                                  <dd>
                                    Room type: {conflict.roomTypeName}
                                  </dd>
                                </div>
                              ) : null}
                              {conflict.campusName ? (
                                <div>
                                  <dt className="sr-only">Campus</dt>
                                  <dd>Campus: {conflict.campusName}</dd>
                                </div>
                              ) : null}
                              {conflict.blockedReason ? (
                                <div>
                                  <dt className="sr-only">Blocked reason</dt>
                                  <dd>
                                    Blocked: {conflict.blockedReason}
                                  </dd>
                                </div>
                              ) : null}
                              {conflict.requestedQuantity !== undefined ? (
                                <div>
                                  <dt className="sr-only">
                                    Requested quantity
                                  </dt>
                                  <dd>
                                    Requested: {conflict.requestedQuantity}
                                  </dd>
                                </div>
                              ) : null}
                              {conflict.availableQuantity !== undefined ? (
                                <div>
                                  <dt className="sr-only">
                                    Available quantity
                                  </dt>
                                  <dd>
                                    Available: {conflict.availableQuantity}
                                  </dd>
                                </div>
                              ) : null}
                              {conflict.missingQuantity !== undefined ? (
                                <div>
                                  <dt className="sr-only">
                                    Missing quantity
                                  </dt>
                                  <dd>
                                    Missing: {conflict.missingQuantity}
                                  </dd>
                                </div>
                              ) : null}
                              {conflict.unavailableRooms?.length ? (
                                <div>
                                  <dt className="sr-only">
                                    Unavailable rooms
                                  </dt>
                                  <dd>
                                    Unavailable:{" "}
                                    {conflict.unavailableRooms
                                      .map(
                                        (r) => `${r.code} (${r.reason})`
                                      )
                                      .join(", ")}
                                  </dd>
                                </div>
                              ) : null}
                            </dl>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
                  <CheckCircle className="size-4 shrink-0 text-primary" aria-hidden />
                  No conflicts detected against approved bookings, pending
                  bookings, or blocked periods.
                </div>
              )}
            </CollapsibleCard>
          ) : null}

          {/* -------------------------------------------------------------- */}
          {/* Files                                                            */}
          {/* -------------------------------------------------------------- */}
          <CollapsibleCard
            title="Files"
            icon={FileText}
            defaultOpen={true}
            badge={
              <Badge variant="outline" className="text-xs">
                {request.attachmentStorageIds.length}
              </Badge>
            }
          >
            {request.attachmentStorageIds.length === 0 ? (
              <p className="text-sm italic text-muted-foreground">
                No attachments uploaded.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {request.attachmentStorageIds.length} attachment
                {request.attachmentStorageIds.length === 1 ? "" : "s"}.
              </p>
            )}
          </CollapsibleCard>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Dialogs                                                              */}
      {/* ------------------------------------------------------------------ */}

      {/* Override confirmation */}
      <AlertDialog
        open={overrideAction !== null}
        onOpenChange={(open) => {
          if (!open) setOverrideAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{overrideAction?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {overrideAction?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={statusBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={statusBusy}
              onClick={() => {
                if (!overrideAction) return;
                const action = overrideAction;
                setOverrideAction(null);
                void runStatusUpdate({
                  status: action.status,
                  allowConflictOverride: action.overrideType === "conflict",
                  allowCompletedOverride: action.overrideType === "completed",
                });
              }}
            >
              Continue with override
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reason/comment dialog */}
      <Dialog
        open={reasonAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setReasonAction(null);
            setStatusReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reasonAction?.title}</DialogTitle>
            <DialogDescription>{reasonAction?.description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <label
              htmlFor="status-reason"
              className="text-sm font-medium text-foreground"
            >
              Reason / comment{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </label>
            <Textarea
              id="status-reason"
              value={statusReason}
              onChange={(event) => setStatusReason(event.currentTarget.value)}
              placeholder="Add a short reason or leave blank."
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={statusBusy}
              onClick={() => {
                setReasonAction(null);
                setStatusReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={
                reasonAction?.status === "Declined" ? "destructive" : "default"
              }
              disabled={statusBusy}
              onClick={() => {
                if (!reasonAction) return;
                const action = reasonAction;
                const reason = statusReason.trim();
                setReasonAction(null);
                setStatusReason("");
                void runStatusUpdate({
                  status: action.status,
                  reason: reason || undefined,
                });
              }}
            >
              {statusBusy ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
              ) : null}
              {reasonAction?.status === "Declined"
                ? "Decline booking"
                : "Cancel booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
