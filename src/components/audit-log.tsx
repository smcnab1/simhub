"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { CalendarClock, ChevronDown, ClipboardList, Filter, Search } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useOptionalDashboardAuth } from "@/components/dashboard-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionHeader } from "@/components/ui";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { auditEventLabel, auditEventTypes } from "@/lib/audit-types";
import { useTenantLink } from "@/lib/use-tenant-link";

function formatEventTime(value: number) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function severityTone(severity?: string) {
  if (severity === "critical") return "border-destructive/40 bg-destructive/10 text-destructive";
  if (severity === "warning") return "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200";
  return "border-primary/30 bg-primary/10 text-primary";
}

function dateToMillis(value: string, endOfDay = false) {
  if (!value) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  const timestamp = date.getTime();
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

type AuditEvent = {
  _id: Id<"auditEvents">;
  eventType: string;
  entityType: string;
  entityId: string;
  bookingId?: Id<"bookingRequests">;
  actorName?: string;
  actorEmail?: string;
  message: string;
  severity?: string;
  visibility: string;
  createdAt: number;
  diff?: Array<{ field: string; before: unknown; after: unknown }>;
  metadata?: unknown;
};

function DiffList({ event }: { event: AuditEvent }) {
  if (!event.diff?.length) return null;

  return (
    <details className="mt-2 rounded-lg border border-border bg-muted/40 p-2 text-xs">
      <summary className="cursor-pointer font-medium text-foreground">Changes</summary>
      <div className="mt-2 grid gap-2">
        {event.diff.map((entry) => (
          <div key={entry.field} className="grid gap-1">
            <span className="font-medium text-foreground">{entry.field}</span>
            <code className="overflow-auto rounded bg-background p-2 text-muted-foreground">
              {JSON.stringify({ before: entry.before, after: entry.after })}
            </code>
          </div>
        ))}
      </div>
    </details>
  );
}

export function AuditLog() {
  const auth = useOptionalDashboardAuth();
  const linkFor = useTenantLink(auth?.tenantSlug);
  const [search, setSearch] = useState("");
  const [actor, setActor] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [eventType, setEventType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [cursor, setCursor] = useState<number | undefined>();
  const tenantSlug = auth?.tenantSlug ?? "";
  const canViewAudit =
    auth?.role === "Developer" || auth?.role === "Admin" || auth?.role === "Staff";
  const queryArgs = useMemo(() => {
    if (!auth || !canViewAudit) return "skip" as const;

    return {
      tenantSlug,
      auth,
      bookingId: bookingId.trim()
        ? (bookingId.trim() as Id<"bookingRequests">)
        : undefined,
      eventType: eventType === "all" ? undefined : eventType,
      actor: actor.trim() || undefined,
      search: search.trim() || undefined,
      from: dateToMillis(from),
      to: dateToMillis(to, true),
      cursor,
      limit: 50,
    };
  }, [actor, auth, bookingId, canViewAudit, cursor, eventType, from, search, tenantSlug, to]);
  const result = useQuery(api.audit.listTenantEvents, queryArgs);
  const events = result?.events ?? [];

  function resetFilters() {
    setSearch("");
    setActor("");
    setBookingId("");
    setEventType("all");
    setFrom("");
    setTo("");
    setCursor(undefined);
  }

  return (
    <div className="flex flex-col gap-5 pb-16">
      <SectionHeader
        eyebrow="Operations"
        title="Audit log"
        action={<Badge variant="outline">{result?.hasMore ? "Filtered page" : `${events.length} events`}</Badge>}
      />

      <Card>
        {!canViewAudit ? (
          <p className="text-sm text-muted-foreground">
            Staff access is required to view tenant audit events.
          </p>
        ) : null}
        <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-foreground">Search</span>
            <span className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.currentTarget.value)} className="pl-9" placeholder="Message, entity, reference" />
            </span>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-foreground">Actor</span>
            <Input value={actor} onChange={(event) => setActor(event.currentTarget.value)} placeholder="Name or email" />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-foreground">Booking</span>
            <Input value={bookingId} onChange={(event) => setBookingId(event.currentTarget.value)} placeholder="Booking id" />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-foreground">Event type</span>
            <Select value={eventType} onValueChange={(value) => { setEventType(value ?? "all"); setCursor(undefined); }}>
              <SelectTrigger>
                <SelectValue placeholder="All event types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All event types</SelectItem>
                {auditEventTypes.map((type) => (
                  <SelectItem key={type} value={type}>{auditEventLabel(type)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <div className="flex items-end">
            <Button type="button" variant="outline" onClick={resetFilters}>
              <Filter className="size-4" />
              Reset
            </Button>
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-foreground">From</span>
            <Input type="date" value={from} onChange={(event) => { setFrom(event.currentTarget.value); setCursor(undefined); }} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-foreground">To</span>
            <Input type="date" value={to} onChange={(event) => { setTo(event.currentTarget.value); setCursor(undefined); }} />
          </label>
        </div>
      </Card>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="grid grid-cols-[1fr_170px_190px_120px] gap-3 border-b border-border bg-muted/40 px-4 py-3 text-xs font-medium uppercase text-muted-foreground max-lg:hidden">
          <span>Event</span>
          <span>Actor</span>
          <span>When</span>
          <span>Severity</span>
        </div>
        {result === undefined ? (
          <p className="p-4 text-sm text-muted-foreground">Loading audit events...</p>
        ) : events.length ? (
          <div className="divide-y divide-border">
            {events.map((event) => (
              <article key={event._id} className="grid gap-3 px-4 py-3 lg:grid-cols-[1fr_170px_190px_120px]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{auditEventLabel(event.eventType)}</Badge>
                    <Badge variant="outline">{event.visibility}</Badge>
                    {event.bookingId ? (
                      <Link className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" href={linkFor(`/dashboard/requests/${event.bookingId}`)}>
                        <ClipboardList className="size-3.5" />
                        Booking
                      </Link>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm font-medium text-foreground">{event.message}</p>
                  <p className="mt-1 break-all text-xs text-muted-foreground">{event.entityType}: {event.entityId}</p>
                  <DiffList event={event} />
                </div>
                <div className="text-sm">
                  <p className="font-medium text-foreground">{event.actorName ?? "System"}</p>
                  {event.actorEmail ? <p className="break-all text-xs text-muted-foreground">{event.actorEmail}</p> : null}
                </div>
                <div className="inline-flex items-start gap-1.5 text-sm text-muted-foreground">
                  <CalendarClock className="mt-0.5 size-4" />
                  {formatEventTime(event.createdAt)}
                </div>
                <div>
                  <Badge variant="outline" className={severityTone(event.severity)}>{event.severity ?? "info"}</Badge>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">No audit events match these filters.</p>
        )}
      </div>

      {result?.hasMore ? (
        <Button type="button" variant="outline" className="self-start" onClick={() => setCursor(result.nextCursor)}>
          <ChevronDown className="size-4" />
          Next page
        </Button>
      ) : null}
    </div>
  );
}
