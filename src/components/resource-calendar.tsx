"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Users,
  LayoutGrid,
  Eye,
  EyeOff,
} from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, SectionHeader, StatusPill } from "@/components/ui";
import { TENANT_SLUG } from "@/lib/config";

// ─── Constants ───────────────────────────────────────────────────────────────

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 18;
const TOTAL_VISIBLE_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60;
const hours = Array.from(
  { length: DAY_END_HOUR - DAY_START_HOUR },
  (_, i) => DAY_START_HOUR + i
);

const UNASSIGNED_CAMPUS_ID = "__unassigned__";

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingBlock = {
  label: "Setup" | "Session" | "Cleanup";
  start: string;
  end: string;
};

type CalendarRoom = {
  _id: string;
  code: string;
  name: string;
  capacity: number;
  campusId?: string;
  active: boolean;
  roomType?: { name: string } | null;
  campus?: { _id: string; name: string } | null;
};

type CalendarRequest = {
  _id: string;
  sessionName: string;
  requesterName: string;
  attendeeCount: number;
  status: string;
  blocks: BookingBlock[];
  assignedRoomIds?: string[];
  requestedRoomIds?: string[];
  assignedRooms?: Array<{ _id: string }>;
};

type CalendarCampus = {
  _id: string;
  name: string;
};

type CampusGroup = {
  campusId: string;
  campusName: string;
  rooms: CalendarRoom[];
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

function startOfToday() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addWeeks(date: Date, amount: number) {
  return addDays(date, amount * 7);
}

function addMonths(date: Date, amount: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + amount);
  return next;
}

function addYears(date: Date, amount: number) {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + amount);
  return next;
}

function getMonthDays(date: Date) {
  const total = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return Array.from(
    { length: total },
    (_, i) => new Date(date.getFullYear(), date.getMonth(), i + 1)
  );
}

function formatDateUK(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatMonthYearUK(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatTimeUK(date: Date) {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// ─── Booking placement helpers ────────────────────────────────────────────────

function getBookingWindow(blocks: BookingBlock[]) {
  const starts = blocks.map((b) => new Date(b.start).getTime());
  const ends = blocks.map((b) => new Date(b.end).getTime());
  return {
    start: new Date(Math.min(...starts)),
    end: new Date(Math.max(...ends)),
  };
}

function minutesFromDayStart(date: Date) {
  return (date.getHours() - DAY_START_HOUR) * 60 + date.getMinutes();
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getGridPlacement(blocks: BookingBlock[]) {
  const { start, end } = getBookingWindow(blocks);
  const startMins = clamp(minutesFromDayStart(start), 0, TOTAL_VISIBLE_MINUTES);
  const endMins = clamp(minutesFromDayStart(end), 0, TOTAL_VISIBLE_MINUTES);
  return {
    left: `${(startMins / TOTAL_VISIBLE_MINUTES) * 100}%`,
    width: `${Math.max(((endMins - startMins) / TOTAL_VISIBLE_MINUTES) * 100, 4)}%`,
    timeLabel: `${formatTimeUK(start)}–${formatTimeUK(end)}`,
  };
}

// ─── Booking/room helpers ─────────────────────────────────────────────────────

function requestRoomIds(request: CalendarRequest): Set<string> {
  const ids = new Set<string>();
  request.assignedRoomIds?.forEach((id) => ids.add(id));
  request.requestedRoomIds?.forEach((id) => ids.add(id));
  request.assignedRooms?.forEach((r) => ids.add(r._id));
  return ids;
}

function requestUsesRoom(request: CalendarRequest, roomId: string) {
  return requestRoomIds(request).has(roomId);
}

function isVisibleBooking(request: CalendarRequest) {
  return request.status === "Pending" || request.status === "Approved";
}

function isUnallocated(request: CalendarRequest) {
  const ids = requestRoomIds(request);
  return ids.size === 0;
}

function bookingChipClass(status: string) {
  if (status === "Approved") {
    return "border-blue-600 bg-blue-600 text-white shadow-blue-600/20";
  }
  return "border-slate-300 bg-slate-100 text-slate-700 shadow-slate-200/40";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NavButton({
  onClick,
  children,
  ariaLabel,
}: {
  onClick: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1 rounded-lg border border-blue-100 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-blue-50 hover:text-blue-700"
    >
      {children}
    </button>
  );
}

function FilterToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium shadow-sm transition-colors ${
        active
          ? "border-blue-600 bg-blue-600 text-white"
          : "border-blue-100 bg-white text-slate-600 hover:bg-blue-50 hover:text-blue-700"
      }`}
    >
      {children}
    </button>
  );
}

// Campus header row (collapsed or expanded toggle)
function CampusHeaderRow({
  campusName,
  rooms,
  bookingsForDay,
  isCollapsed,
  isVisible,
  onToggleCollapse,
  onToggleVisibility,
  hourCount,
}: {
  campusName: string;
  rooms: CalendarRoom[];
  bookingsForDay: CalendarRequest[];
  isCollapsed: boolean;
  isVisible: boolean;
  onToggleCollapse: () => void;
  onToggleVisibility: () => void;
  hourCount: number;
}) {
  const campusBookings = bookingsForDay.filter((req) =>
    rooms.some((room) => requestUsesRoom(req, room._id))
  );
  const pendingCount = campusBookings.filter((b) => b.status === "Pending").length;
  const approvedCount = campusBookings.filter((b) => b.status === "Approved").length;

  return (
    <div className="contents" role="rowgroup">
      {/* Campus label cell */}
      <div
        className={`flex items-center justify-between gap-2 border-b border-blue-200 px-3 py-2 ${
          isCollapsed ? "bg-blue-50/70" : "bg-blue-50/40"
        }`}
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={!isCollapsed}
          aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${campusName}`}
        >
          {isCollapsed ? (
            <ChevronRight className="size-3.5 shrink-0 text-blue-600" />
          ) : (
            <ChevronDown className="size-3.5 shrink-0 text-blue-600" />
          )}
          <span className="truncate text-sm font-bold text-slate-900">
            {campusName}
          </span>
        </button>
        <button
          type="button"
          onClick={onToggleVisibility}
          aria-label={isVisible ? `Hide ${campusName}` : `Show ${campusName}`}
          className="shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-600"
        >
          {isVisible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
        </button>
      </div>

      {/* Campus summary timeline (shown when collapsed) */}
      <div
        className={`relative border-b border-l border-blue-200 px-3 py-2 ${
          isCollapsed ? "bg-blue-50/70" : "bg-blue-50/40"
        }`}
        style={{ gridColumn: `span ${hourCount}` }}
      >
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span className="font-medium text-slate-800">
            {rooms.length} room{rooms.length !== 1 ? "s" : ""}
          </span>
          {campusBookings.length > 0 ? (
            <>
              <span className="text-slate-400">·</span>
              <span>{campusBookings.length} booking{campusBookings.length !== 1 ? "s" : ""}</span>
              {pendingCount > 0 && (
                <span className="rounded-full bg-slate-200 px-2 py-0.5 font-medium text-slate-700">
                  {pendingCount} pending
                </span>
              )}
              {approvedCount > 0 && (
                <span className="rounded-full bg-blue-600 px-2 py-0.5 font-medium text-white">
                  {approvedCount} approved
                </span>
              )}
            </>
          ) : (
            <span className="text-slate-400">No bookings today</span>
          )}
        </div>
      </div>
    </div>
  );
}

// Individual room row
function RoomRow({
  room,
  bookings,
  hourCount,
}: {
  room: CalendarRoom;
  bookings: CalendarRequest[];
  hourCount: number;
}) {
  return (
    <div className="contents" role="row">
      {/* Room label */}
      <div className="flex flex-col justify-center border-b border-blue-100 px-3 py-2" role="rowheader">
        <p className="text-sm font-semibold leading-tight text-slate-800">
          {room.code}
        </p>
        <p className="truncate text-xs text-slate-500">{room.name}</p>
        <p className="text-xs text-slate-400">
          {room.roomType?.name ?? "No type"} ·{" "}
          <Users className="mb-0.5 inline size-3" /> {room.capacity}
        </p>
      </div>

      {/* Timeline */}
      <div
        className="relative min-h-[4rem] border-b border-l border-blue-100 bg-white/40"
        style={{ gridColumn: `span ${hourCount}` }}
        role="cell"
      >
        {/* Hour gridlines */}
        <div
          className="pointer-events-none absolute inset-0 grid"
          style={{ gridTemplateColumns: `repeat(${hourCount}, 1fr)` }}
        >
          {hours.map((h) => (
            <div key={h} className="border-l border-blue-50 first:border-l-0" />
          ))}
        </div>

        {/* Booking chips */}
        {bookings.map((booking, idx) => {
          const placement = getGridPlacement(booking.blocks);
          return (
            <a
              key={booking._id}
              href={`/dashboard/requests/${booking._id}`}
              className={`absolute z-10 overflow-hidden rounded-md border px-1.5 py-0.5 text-xs shadow-sm transition-opacity hover:opacity-90 ${bookingChipClass(
                booking.status
              )}`}
              style={{
                left: placement.left,
                width: placement.width,
                top: `${6 + idx * 38}px`,
              }}
              title={`${booking.sessionName} · ${placement.timeLabel} · ${booking.status}`}
            >
              <span className="block truncate font-semibold leading-tight">
                {booking.sessionName}
              </span>
              <span className="block truncate leading-tight opacity-80">
                {placement.timeLabel} · {booking.status}
              </span>
              {booking.requesterName ? (
                <span className="block truncate leading-tight opacity-70">
                  {booking.requesterName}
                </span>
              ) : null}
            </a>
          );
        })}
      </div>
    </div>
  );
}

// Unallocated bookings panel
function UnallocatedPanel({ bookings }: { bookings: CalendarRequest[] }) {
  if (bookings.length === 0) return null;
  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="mb-2 flex items-center gap-2">
        <AlertTriangle className="size-4 text-amber-600" />
        <p className="text-sm font-semibold text-amber-800">
          Unallocated bookings — not assigned to any room
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {bookings.map((b) => (
          <a
            key={b._id}
            href={`/dashboard/requests/${b._id}`}
            className="inline-flex flex-col rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs shadow-sm hover:border-amber-400"
          >
            <span className="font-semibold text-slate-800">{b.sessionName}</span>
            <span className="text-slate-500">
              {b.requesterName} · <StatusPill status={b.status} />
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function ResourceCalendar() {
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfToday());

  // Campus collapse/expand state
  const [collapsedCampusIds, setCollapsedCampusIds] = useState<Set<string>>(
    new Set()
  );
  // Campus visibility (null = all visible)
  const [hiddenCampusIds, setHiddenCampusIds] = useState<Set<string>>(
    new Set()
  );
  const [hideEmptyCampuses, setHideEmptyCampuses] = useState(false);

  // Filters
  const [showPending, setShowPending] = useState(true);
  const [showApproved, setShowApproved] = useState(true);
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>("all");

  // Data
  const rooms = useQuery(api.tenants.listPrivateRooms, {
    tenantSlug: TENANT_SLUG,
    activeOnly: true,
  });
  const campuses = useQuery(api.tenants.listPrivateCampuses, {
    tenantSlug: TENANT_SLUG,
    activeOnly: true,
  });
  const requests = useQuery(api.bookings.listRequests, {
    tenantSlug: TENANT_SLUG,
  });

  const isLoading =
    rooms === undefined || campuses === undefined || requests === undefined;

  const selectedDateString = isoDate(selectedDate);
  const monthDays = useMemo(() => getMonthDays(selectedDate), [selectedDate]);

  // All unique room type names for the filter dropdown
  const roomTypeNames = useMemo(() => {
    if (!rooms) return [];
    const names = new Set<string>();
    rooms.forEach((r) => {
      if (r.roomType?.name) names.add(r.roomType.name);
    });
    return Array.from(names).sort();
  }, [rooms]);

  // Bookings visible on this day (pending/approved + status filter)
  const bookingsForDay = useMemo<CalendarRequest[]>(() => {
    if (!requests) return [];
    return (requests as CalendarRequest[]).filter((req) => {
      if (!isVisibleBooking(req)) return false;
      if (!showPending && req.status === "Pending") return false;
      if (!showApproved && req.status === "Approved") return false;
      return req.blocks.some((b) => b.start.slice(0, 10) === selectedDateString);
    });
  }, [requests, selectedDateString, showPending, showApproved]);

  // Active rooms (with optional room type filter)
  const filteredRooms = useMemo<CalendarRoom[]>(() => {
    if (!rooms) return [];
    return (rooms as CalendarRoom[]).filter((r) => {
      if (roomTypeFilter !== "all" && r.roomType?.name !== roomTypeFilter)
        return false;
      return true;
    });
  }, [rooms, roomTypeFilter]);

  // Group rooms by campus
  const campusGroups = useMemo<CampusGroup[]>(() => {
    if (!campuses || !filteredRooms) return [];

    const campusMap = new Map<string, CampusGroup>();

    // Create a group for each known campus
    (campuses as CalendarCampus[]).forEach((campus) => {
      campusMap.set(campus._id, {
        campusId: campus._id,
        campusName: campus.name,
        rooms: [],
      });
    });

    // Unassigned group
    campusMap.set(UNASSIGNED_CAMPUS_ID, {
      campusId: UNASSIGNED_CAMPUS_ID,
      campusName: "Unassigned / No campus",
      rooms: [],
    });

    // Assign rooms to groups
    filteredRooms.forEach((room) => {
      const key = room.campusId ?? UNASSIGNED_CAMPUS_ID;
      if (!campusMap.has(key)) {
        // Campus exists in room data but not in campus list — add it
        campusMap.set(key, {
          campusId: key,
          campusName: room.campus?.name ?? "Unknown Campus",
          rooms: [],
        });
      }
      campusMap.get(key)!.rooms.push(room);
    });

    // Sort rooms within each group by code
    campusMap.forEach((group) => {
      group.rooms.sort((a, b) => a.code.localeCompare(b.code));
    });

    // Convert to array, filter out empty unassigned group unless it has rooms
    return Array.from(campusMap.values()).filter((g) => g.rooms.length > 0);
  }, [campuses, filteredRooms]);

  // Unallocated bookings (no room assigned at all)
  const unallocatedBookings = useMemo(
    () => bookingsForDay.filter(isUnallocated),
    [bookingsForDay]
  );

  // Campus action helpers
  function toggleCollapse(campusId: string) {
    setCollapsedCampusIds((prev) => {
      const next = new Set(prev);
      if (next.has(campusId)) next.delete(campusId);
      else next.add(campusId);
      return next;
    });
  }

  function collapseAll() {
    setCollapsedCampusIds(new Set(campusGroups.map((g) => g.campusId)));
  }

  function expandAll() {
    setCollapsedCampusIds(new Set());
  }

  function toggleCampusVisibility(campusId: string) {
    setHiddenCampusIds((prev) => {
      const next = new Set(prev);
      if (next.has(campusId)) next.delete(campusId);
      else next.add(campusId);
      return next;
    });
  }

  function showAllCampuses() {
    setHiddenCampusIds(new Set());
    setHideEmptyCampuses(false);
  }

  // Visible groups after applying campus hide filters
  const visibleGroups = useMemo(() => {
    return campusGroups.filter((g) => {
      if (hiddenCampusIds.has(g.campusId)) return false;
      if (hideEmptyCampuses) {
        const campusHasBooking = bookingsForDay.some((req) =>
          g.rooms.some((r) => requestUsesRoom(req, r._id))
        );
        if (!campusHasBooking) return false;
      }
      return true;
    });
  }, [campusGroups, hiddenCampusIds, hideEmptyCampuses, bookingsForDay]);

  const totalRooms = filteredRooms.length;
  const hourCount = hours.length;

  return (
    <>
      <SectionHeader
        title="Resource Calendar"
        eyebrow="Operations"
        action={
          <div className="flex flex-wrap gap-2">
            <button className="rounded-lg border border-blue-100 bg-white/90 px-3 py-2 text-sm font-medium shadow-sm hover:bg-blue-50">
              Block Time
            </button>
            <a
              href="/book"
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700"
            >
              Add booking
            </a>
          </div>
        }
      />

      <Card>
        {/* ── Date summary ──────────────────────────────────────────── */}
        <div className="mb-5 grid gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-balance font-bold text-slate-950">
                {formatDateUK(selectedDate)}
              </h2>
              <p className="text-sm text-slate-500">
                {bookingsForDay.length} booking{bookingsForDay.length !== 1 ? "s" : ""} ·{" "}
                {totalRooms} room{totalRooms !== 1 ? "s" : ""}
                {unallocatedBookings.length > 0 && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    <AlertTriangle className="size-3" />
                    {unallocatedBookings.length} unallocated
                  </span>
                )}
              </p>
            </div>

            {/* ── Navigation buttons ─────────────────────────────────── */}
            <div className="flex flex-wrap gap-1.5">
              {/* Year nav */}
              <div className="flex items-center gap-0.5">
                <NavButton onClick={() => setSelectedDate(addYears(selectedDate, -1))}>
                  <ChevronLeft className="size-3" />
                  <ChevronLeft className="-ml-2 size-3" />
                  Yr
                </NavButton>
                <NavButton onClick={() => setSelectedDate(addYears(selectedDate, 1))}>
                  Yr
                  <ChevronRight className="size-3" />
                  <ChevronRight className="-ml-2 size-3" />
                </NavButton>
              </div>

              {/* Month nav */}
              <div className="flex items-center gap-0.5">
                <NavButton
                  onClick={() => setSelectedDate(addMonths(selectedDate, -1))}
                  ariaLabel="Previous month"
                >
                  <ChevronLeft className="size-3" /> Mo
                </NavButton>
                <NavButton
                  onClick={() => setSelectedDate(addMonths(selectedDate, 1))}
                  ariaLabel="Next month"
                >
                  Mo <ChevronRight className="size-3" />
                </NavButton>
              </div>

              {/* Week nav */}
              <div className="flex items-center gap-0.5">
                <NavButton
                  onClick={() => setSelectedDate(addWeeks(selectedDate, -1))}
                  ariaLabel="Previous week"
                >
                  <ChevronLeft className="size-3" /> Wk
                </NavButton>
                <NavButton
                  onClick={() => setSelectedDate(addWeeks(selectedDate, 1))}
                  ariaLabel="Next week"
                >
                  Wk <ChevronRight className="size-3" />
                </NavButton>
              </div>

              {/* Day nav + Today */}
              <div className="flex items-center gap-0.5">
                <NavButton
                  onClick={() => setSelectedDate(addDays(selectedDate, -1))}
                  ariaLabel="Previous day"
                >
                  <ChevronLeft className="size-3" />
                </NavButton>

                <button
                  type="button"
                  onClick={() => setSelectedDate(startOfToday())}
                  className="rounded-lg border border-blue-600 bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
                >
                  Today
                </button>

                <NavButton
                  onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                  ariaLabel="Next day"
                >
                  <ChevronRight className="size-3" />
                </NavButton>
              </div>
            </div>
          </div>

          {/* ── Month day strip ──────────────────────────────────────── */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {formatMonthYearUK(selectedDate)}
            </p>
            <div className="flex max-w-full gap-1.5 overflow-x-auto pb-1">
              {monthDays.map((day) => {
                const ds = isoDate(day);
                const isSelected = ds === selectedDateString;
                const hasBooking = (requests as CalendarRequest[] | undefined)?.some(
                  (req) =>
                    isVisibleBooking(req) &&
                    req.blocks.some((b) => b.start.slice(0, 10) === ds)
                );
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => setSelectedDate(day)}
                    aria-pressed={isSelected}
                    aria-label={formatDateUK(day)}
                    className={`relative size-10 shrink-0 rounded-xl border text-sm font-semibold transition-colors ${
                      isSelected
                        ? "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-600/20"
                        : "border-blue-100 bg-white/80 text-slate-700 hover:bg-blue-50"
                    }`}
                  >
                    {day.getDate()}
                    {hasBooking ? (
                      <span
                        className={`absolute bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full ${
                          isSelected ? "bg-white" : "bg-blue-600"
                        }`}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Filters + campus controls ────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2 border-t border-blue-50 pt-3">
            {/* Status filters */}
            <span className="text-xs font-medium text-slate-500">Status:</span>
            <FilterToggle active={showPending} onClick={() => setShowPending((v) => !v)}>
              Pending
            </FilterToggle>
            <FilterToggle active={showApproved} onClick={() => setShowApproved((v) => !v)}>
              Approved
            </FilterToggle>

            {/* Room type filter */}
            {roomTypeNames.length > 0 && (
              <>
                <span className="ml-2 text-xs font-medium text-slate-500">
                  Room type:
                </span>
                <div className="relative">
                  <select
                    value={roomTypeFilter}
                    onChange={(e) => setRoomTypeFilter(e.target.value)}
                    className="appearance-none rounded-lg border border-blue-100 bg-white py-1.5 pl-2.5 pr-7 text-xs font-medium text-slate-700 shadow-sm hover:bg-blue-50"
                  >
                    <option value="all">All types</option>
                    {roomTypeNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <LayoutGrid className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-slate-400" />
                </div>
              </>
            )}

            {/* Campus collapse controls */}
            <span className="ml-2 text-xs font-medium text-slate-500">
              Campuses:
            </span>
            <button
              type="button"
              onClick={expandAll}
              className="inline-flex items-center gap-1 rounded-lg border border-blue-100 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-blue-50"
            >
              <ChevronDown className="size-3" /> Expand all
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="inline-flex items-center gap-1 rounded-lg border border-blue-100 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-blue-50"
            >
              <ChevronUp className="size-3" /> Collapse all
            </button>
            <FilterToggle
              active={hideEmptyCampuses}
              onClick={() => setHideEmptyCampuses((v) => !v)}
            >
              <EyeOff className="size-3" /> Hide empty
            </FilterToggle>
            {(hiddenCampusIds.size > 0 || hideEmptyCampuses) && (
              <button
                type="button"
                onClick={showAllCampuses}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 shadow-sm hover:bg-amber-100"
              >
                <Eye className="size-3" /> Show all
              </button>
            )}
          </div>
        </div>

        {/* ── Loading/empty states ─────────────────────────────────────── */}
        {isLoading ? (
          <div className="rounded-xl border border-dashed border-blue-100 bg-white/60 p-6 text-center text-sm text-slate-500">
            Loading rooms and bookings…
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="rounded-xl border border-dashed border-blue-100 bg-white/60 p-6 text-center text-sm text-slate-500">
            {(rooms?.length ?? 0) === 0
              ? "No rooms configured yet. Add rooms in Admin → Rooms."
              : "No rooms match the current filter."}
          </div>
        ) : (
          <>
            {/* ── Unallocated warning panel ──────────────────────────── */}
            <UnallocatedPanel bookings={unallocatedBookings} />

            {/* ── Calendar grid ─────────────────────────────────────── */}
            <div className="overflow-x-auto">
              <div
                className="grid min-w-[1060px]"
                style={{
                  gridTemplateColumns: `260px repeat(${hourCount}, minmax(82px, 1fr))`,
                }}
                role="grid"
                aria-label="Resource calendar"
              >
                {/* Header row: room label + hour headers */}
                <div
                  className="border-b border-blue-100 bg-white/60 px-3 py-2 text-xs font-semibold text-slate-500"
                  role="columnheader"
                >
                  Room
                </div>
                {hours.map((h) => (
                  <div
                    key={h}
                    className="border-b border-blue-100 p-2 text-center text-xs font-medium text-slate-400"
                    role="columnheader"
                  >
                    {String(h).padStart(2, "0")}:00
                  </div>
                ))}

                {/* Campus groups */}
                {visibleGroups.map((group) => {
                  const isCollapsed = collapsedCampusIds.has(group.campusId);
                  const isVisible = !hiddenCampusIds.has(group.campusId);

                  return (
                    <div key={group.campusId} className="contents">
                      <CampusHeaderRow
                        campusName={group.campusName}
                        rooms={group.rooms}
                        bookingsForDay={bookingsForDay}
                        isCollapsed={isCollapsed}
                        isVisible={isVisible}
                        onToggleCollapse={() => toggleCollapse(group.campusId)}
                        onToggleVisibility={() =>
                          toggleCampusVisibility(group.campusId)
                        }
                        hourCount={hourCount}
                      />

                      {!isCollapsed &&
                        group.rooms.map((room) => {
                          const roomBookings = bookingsForDay.filter((req) =>
                            requestUsesRoom(req, room._id)
                          );
                          return (
                            <RoomRow
                              key={room._id}
                              room={room}
                              bookings={roomBookings}
                              hourCount={hourCount}
                            />
                          );
                        })}
                    </div>
                  );
                })}

                {/* No visible campuses fallback */}
                {visibleGroups.length === 0 && (
                  <div
                    className="col-span-full p-6 text-center text-sm text-slate-500"
                    style={{ gridColumn: `span ${hourCount + 1}` }}
                  >
                    All campuses are hidden. Use{" "}
                    <button
                      type="button"
                      onClick={showAllCampuses}
                      className="font-medium text-blue-600 underline hover:no-underline"
                    >
                      Show all
                    </button>{" "}
                    to restore them.
                  </div>
                )}
              </div>
            </div>

            {/* ── Legend ───────────────────────────────────────────────── */}
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <span className="font-medium text-slate-500">Legend:</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-slate-700">
                <span className="size-2 rounded-full bg-slate-400" />
                Pending
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-600 bg-blue-600 px-3 py-1 text-white">
                <span className="size-2 rounded-full bg-white" />
                Approved
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-amber-700">
                <AlertTriangle className="size-3" />
                Unallocated
              </span>
              <span className="ml-auto flex items-center gap-1 text-slate-400">
                <ChevronsUpDown className="size-3" /> Click campus header to expand/collapse
              </span>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
