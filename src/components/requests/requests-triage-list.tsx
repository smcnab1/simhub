"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Clock,
  Search,
  Users,
} from "lucide-react";

import { api } from "../../../convex/_generated/api";
import { useDashboardAuth } from "@/components/dashboard-auth";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  RequestConflictBadge,
  RequestNeedsAttentionBadge,
  RequestUnallocatedBadge,
} from "@/components/requests/request-badges";
import { SectionHeader, emptyStateClass, tableContainerClass } from "@/components/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRequestDate, formatRooms } from "@/lib/format";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BookingStatus =
  | "All"
  | "Pending"
  | "Approved"
  | "Confirmed"
  | "Completed"
  | "Declined"
  | "Cancelled";

const STATUS_TABS: BookingStatus[] = [
  "All",
  "Pending",
  "Approved",
  "Confirmed",
  "Completed",
  "Declined",
  "Cancelled",
];

/** Derive from the shape returned by listRequestsForTriage (withAssignedRooms) */
type TriageRequest = {
  _id: string;
  status: string;
  sessionName: string;
  requesterName: string;
  requesterEmail: string;
  blocks: Array<{ label: string; start: string; end: string }>;
  timezone?: string;
  assignedRoomIds: string[];
  assignedRooms: Array<{ _id: string; code: string; name: string }>;
  allocationStatus?: string;
  conflictMetadata?: {
    available: boolean;
    canSubmit: boolean;
    highestSeverity?: string;
    summary: string;
    conflicts: Array<{ type: string; severity: string; message: string }>;
  };
  createdAt: number;
  updatedAt: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true when the stored conflict metadata contains actual (non-info) conflicts */
function hasRealConflicts(request: TriageRequest): boolean {
  if (!request.conflictMetadata) return false;
  return request.conflictMetadata.conflicts.some(
    (c) => c.severity === "likely_unavailable" || c.severity === "warning"
  );
}

/** Returns true when no rooms are assigned and the status warrants allocation */
function isUnallocated(request: TriageRequest): boolean {
  const needsAllocation =
    request.status === "Pending" || request.status === "Approved" || request.status === "Confirmed";
  return needsAllocation && request.assignedRoomIds.length === 0;
}

/** Returns true when allocationStatus signals manual intervention needed */
function needsAttention(request: TriageRequest): boolean {
  return (
    request.allocationStatus === "ManualReviewRequired" ||
    request.allocationStatus === "Conflict"
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SummaryCards({
  requests,
}: {
  requests: TriageRequest[];
}) {
  const pending = requests.filter((r) => r.status === "Pending").length;
  const approved = requests.filter((r) => r.status === "Approved").length;
  const withConflicts = requests.filter(hasRealConflicts).length;
  const unallocated = requests.filter(isUnallocated).length;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <SummaryCard
        label="Pending"
        value={pending}
        detail="Awaiting review"
        accent="primary"
      />
      <SummaryCard
        label="Approved"
        value={approved}
        detail="Ready to run"
        accent="primary"
      />
      <SummaryCard
        label="Conflicts"
        value={withConflicts}
        detail="Scheduling issues"
        accent={withConflicts > 0 ? "destructive" : "muted"}
      />
      <SummaryCard
        label="Unallocated"
        value={unallocated}
        detail="No rooms assigned"
        accent={unallocated > 0 ? "amber" : "muted"}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: number;
  detail: string;
  accent: "primary" | "destructive" | "amber" | "muted";
}) {
  const accentClass = {
    primary: "text-primary",
    destructive: "text-destructive",
    amber: "text-amber-600 dark:text-amber-400",
    muted: "text-muted-foreground",
  }[accent];

  return (
    <Card className="rounded-2xl border-border bg-card shadow-sm">
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={cn("mt-1.5 text-2xl font-bold tabular-nums", accentClass)}>
          {value}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton className="h-4 w-28" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-32" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-40" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-16 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-12" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

function SkeletonCards() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-border bg-card p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </>
  );
}

function EmptyState({ statusFilter }: { statusFilter: BookingStatus }) {
  return (
    <div className={cn(emptyStateClass, "flex flex-col items-center gap-3 py-12 text-center")}>
      <CalendarDays className="size-8 text-muted-foreground/50" aria-hidden="true" />
      <p className="font-medium text-foreground">No requests found</p>
      <p className="max-w-xs text-sm">
        {statusFilter === "All"
          ? "There are no booking requests yet. When requesters submit sessions, they will appear here."
          : `There are no ${statusFilter.toLowerCase()} requests matching your search.`}
      </p>
    </div>
  );
}

function RequestRow({ request }: { request: TriageRequest }) {
  const conflict = hasRealConflicts(request);
  const unalloc = isUnallocated(request);
  const attention = needsAttention(request);
  const dateStr = formatRequestDate(request);
  const roomsStr = formatRooms(request);

  return (
    <TableRow className="group">
      {/* Date */}
      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <Clock className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
          {dateStr}
        </div>
      </TableCell>

      {/* Requester */}
      <TableCell className="max-w-[160px]">
        <div className="flex items-center gap-1.5">
          <Users className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
          <span className="truncate text-sm text-foreground">{request.requesterName}</span>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{request.requesterEmail}</p>
      </TableCell>

      {/* Session name */}
      <TableCell className="max-w-[200px]">
        <span className="block truncate text-sm font-medium text-foreground">
          {request.sessionName}
        </span>
      </TableCell>

      {/* Status */}
      <TableCell>
        <StatusBadge status={request.status} />
      </TableCell>

      {/* Rooms */}
      <TableCell className="max-w-[180px]">
        <span className="block truncate text-sm text-muted-foreground">{roomsStr}</span>
      </TableCell>

      {/* Indicators */}
      <TableCell>
        <div className="flex flex-wrap items-center gap-1">
          {conflict && <RequestConflictBadge />}
          {unalloc && <RequestUnallocatedBadge />}
          {attention && !conflict && <RequestNeedsAttentionBadge />}
        </div>
      </TableCell>

      {/* Link */}
      <TableCell>
        <Link
          href={`/dashboard/requests/${request._id}`}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground shadow-sm transition hover:bg-muted hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label={`View request: ${request.sessionName}`}
        >
          View
          <ArrowRight className="size-3" aria-hidden="true" />
        </Link>
      </TableCell>
    </TableRow>
  );
}

function RequestMobileCard({ request }: { request: TriageRequest }) {
  const conflict = hasRealConflicts(request);
  const unalloc = isUnallocated(request);
  const attention = needsAttention(request);
  const dateStr = formatRequestDate(request);
  const roomsStr = formatRooms(request);

  return (
    <Link
      href={`/dashboard/requests/${request._id}`}
      className="block rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-ring hover:bg-muted/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/50"
      aria-label={`Booking request: ${request.sessionName}`}
    >
      {/* Top row: date + status */}
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-muted-foreground">{dateStr}</p>
        <StatusBadge status={request.status} />
      </div>

      {/* Session name */}
      <h3 className="mt-1.5 text-sm font-semibold text-foreground leading-snug">
        {request.sessionName}
      </h3>

      {/* Requester */}
      <p className="mt-1 text-xs text-muted-foreground">
        {request.requesterName}
        {request.requesterEmail ? (
          <span className="ml-1 opacity-70">· {request.requesterEmail}</span>
        ) : null}
      </p>

      {/* Rooms */}
      <p className="mt-1.5 text-xs text-muted-foreground">{roomsStr}</p>

      {/* Indicators */}
      {(conflict || unalloc || attention) && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {conflict && <RequestConflictBadge />}
          {unalloc && <RequestUnallocatedBadge />}
          {attention && !conflict && <RequestNeedsAttentionBadge />}
        </div>
      )}
    </Link>
  );
}

function RequestsTable({
  requests,
  isLoading,
  statusFilter,
}: {
  requests: TriageRequest[] | null;
  isLoading: boolean;
  statusFilter: BookingStatus;
}) {
  return (
    <div className={cn(tableContainerClass, "hidden md:block")}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4 text-xs">Date / Time</TableHead>
            <TableHead className="text-xs">Requester</TableHead>
            <TableHead className="text-xs">Session</TableHead>
            <TableHead className="text-xs">Status</TableHead>
            <TableHead className="text-xs">Rooms</TableHead>
            <TableHead className="text-xs">Flags</TableHead>
            <TableHead className="pr-4 text-xs">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <SkeletonRows />
          ) : requests && requests.length > 0 ? (
            requests.map((r) => <RequestRow key={r._id} request={r} />)
          ) : (
            <TableRow>
              <TableCell colSpan={7} className="px-4 py-0">
                <EmptyState statusFilter={statusFilter} />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function RequestsMobileList({
  requests,
  isLoading,
  statusFilter,
}: {
  requests: TriageRequest[] | null;
  isLoading: boolean;
  statusFilter: BookingStatus;
}) {
  return (
    <div className="grid gap-3 md:hidden">
      {isLoading ? (
        <SkeletonCards />
      ) : requests && requests.length > 0 ? (
        requests.map((r) => <RequestMobileCard key={r._id} request={r} />)
      ) : (
        <EmptyState statusFilter={statusFilter} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function RequestsTriageList() {
  const auth = useDashboardAuth();
  const [activeTab, setActiveTab] = useState<BookingStatus>("All");
  const [search, setSearch] = useState("");

  // Fetch all requests — let client-side tabs/search filter from a single
  // reactive subscription so switching tabs is instant.
  const requests = useQuery(api.bookings.listRequestsForTriage, {
    tenantSlug: auth.tenantSlug,
    auth,
  });

  const isLoading = requests === undefined;

  // Base UI onValueChange passes (value: Tabs.Tab.Value, eventDetails) where
  // Tabs.Tab.Value can be string | number | null. We cast to BookingStatus.
  function handleTabChange(value: unknown) {
    if (typeof value === "string") {
      setActiveTab(value as BookingStatus);
    }
  }

  const filteredRequests = useMemo((): TriageRequest[] | null => {
    if (!requests) return null;

    let result = requests as TriageRequest[];

    if (activeTab !== "All") {
      result = result.filter((r) => r.status === activeTab);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (r) =>
          r.sessionName.toLowerCase().includes(q) ||
          r.requesterName.toLowerCase().includes(q) ||
          r.requesterEmail.toLowerCase().includes(q) ||
          r.assignedRooms.some(
            (room) =>
              room.name.toLowerCase().includes(q) ||
              room.code.toLowerCase().includes(q)
          )
      );
    }

    return result;
  }, [requests, activeTab, search]);

  // Tab counts from unfiltered data
  const countFor = (status: BookingStatus) => {
    if (!requests) return null;
    if (status === "All") return requests.length;
    return (requests as TriageRequest[]).filter((r) => r.status === status).length;
  };

  return (
    <>
      {/* Page header */}
      <SectionHeader
        eyebrow="Workflow"
        title="Booking Requests"
        action={
          <Link
            href="/book"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <CalendarDays className="size-4" aria-hidden="true" />
            New request
          </Link>
        }
      />

      <p className="text-sm text-muted-foreground -mt-3 mb-1">
        Review, filter, and triage incoming booking requests. Use the tabs to focus on a specific status, or search by session name, requester, or room.
      </p>

      {/* Summary cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="rounded-2xl border-border bg-card shadow-sm">
              <CardContent className="p-4">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="mt-2 h-7 w-10" />
                <Skeleton className="mt-1.5 h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <SummaryCards requests={(requests as TriageRequest[]) ?? []} />
      )}

      {/* Tabs + search row */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
      >
        {/* Filter row */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="flex h-auto w-full flex-wrap gap-1 bg-muted p-1 sm:w-auto sm:flex-nowrap">
            {STATUS_TABS.map((status) => {
              const count = countFor(status);
              return (
                <TabsTrigger
                  key={status}
                  value={status}
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs"
                >
                  {status}
                  {count !== null && (
                    <span
                      className={cn(
                        "ml-0.5 rounded-full px-1.5 py-0 text-[10px] font-semibold tabular-nums",
                        activeTab === status
                          ? "bg-primary/15 text-primary"
                          : "bg-muted-foreground/15 text-muted-foreground"
                      )}
                      aria-label={`${count} ${status.toLowerCase()} requests`}
                    >
                      {count}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              placeholder="Search by session, requester, room…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9 text-sm"
              aria-label="Search booking requests"
            />
          </div>
        </div>

        {/* Alert when filtering by attention-needed flags */}
        {!isLoading && requests && (
          (() => {
            const attentionCount = (requests as TriageRequest[]).filter(
              (r) => hasRealConflicts(r) || needsAttention(r)
            ).length;
            if (attentionCount === 0) return null;
            return (
              <div
                className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400"
                role="alert"
                aria-live="polite"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  <strong>{attentionCount}</strong>{" "}
                  {attentionCount === 1 ? "request needs" : "requests need"} staff attention — look for conflict or unallocated badges in the list.
                </span>
              </div>
            );
          })()
        )}

        {/* Content panel (shared across all tabs — filtering is client-side) */}
        {STATUS_TABS.map((status) => (
          <TabsContent key={status} value={status} className="mt-0">
            <RequestsTable
              requests={filteredRequests}
              isLoading={isLoading}
              statusFilter={activeTab}
            />
            <RequestsMobileList
              requests={filteredRequests}
              isLoading={isLoading}
              statusFilter={activeTab}
            />
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}
