"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, SectionHeader } from "@/components/ui";
import { TENANT_SLUG } from "@/lib/config";

const dayStartHour = 8;
const dayEndHour = 18;
const hours = Array.from(
  { length: dayEndHour - dayStartHour },
  (_, index) => dayStartHour + index
);

type BookingBlock = {
  label: "Setup" | "Session" | "Cleanup";
  start: string;
  end: string;
};

type CalendarRequest = {
  _id: string;
  sessionName: string;
  requesterName: string;
  status: string;
  blocks: BookingBlock[];
  assignedRoomIds?: string[];
  requestedRoomIds?: string[];
  assignedRooms?: Array<{ _id: string }>;
};

function startOfToday() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
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
  const totalDays = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

  return Array.from({ length: totalDays }, (_, index) => {
    return new Date(date.getFullYear(), date.getMonth(), index + 1);
  });
}

function formatDateLabel(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function getBookingWindow(blocks: BookingBlock[]) {
  const starts = blocks.map((block) => new Date(block.start).getTime());
  const ends = blocks.map((block) => new Date(block.end).getTime());

  return {
    start: new Date(Math.min(...starts)),
    end: new Date(Math.max(...ends)),
  };
}

function getMinutesFromDayStart(date: Date) {
  return (date.getHours() - dayStartHour) * 60 + date.getMinutes();
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getGridPlacement(blocks: BookingBlock[]) {
  const { start, end } = getBookingWindow(blocks);

  const totalMinutes = (dayEndHour - dayStartHour) * 60;
  const startMinutes = clamp(getMinutesFromDayStart(start), 0, totalMinutes);
  const endMinutes = clamp(getMinutesFromDayStart(end), 0, totalMinutes);

  const leftPercent = (startMinutes / totalMinutes) * 100;
  const widthPercent = Math.max(((endMinutes - startMinutes) / totalMinutes) * 100, 4);

  return {
    left: `${leftPercent}%`,
    width: `${widthPercent}%`,
    label: `${start.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    })}-${end.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    })}`,
  };
}

function requestRoomIds(request: CalendarRequest) {
  const ids = new Set<string>();

  request.assignedRoomIds?.forEach((id) => ids.add(id));
  request.requestedRoomIds?.forEach((id) => ids.add(id));
  request.assignedRooms?.forEach((room) => ids.add(room._id));

  return ids;
}

function requestUsesRoom(request: CalendarRequest, roomId: string) {
  return requestRoomIds(request).has(roomId);
}

function requestIsVisibleOnCalendar(request: CalendarRequest) {
  return request.status === "Pending" || request.status === "Approved";
}

function bookingTone(status: string) {
  if (status === "Approved") {
    return "border-blue-600 bg-blue-600 text-white shadow-blue-600/20";
  }

  return "border-slate-300 bg-slate-200 text-slate-700 shadow-slate-300/30";
}

export function ResourceCalendar() {
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfToday());

  const requests = useQuery(api.bookings.listRequests, {
    tenantSlug: TENANT_SLUG,
  });

  const rooms = useQuery(api.tenants.listPrivateRooms, {
    tenantSlug: TENANT_SLUG,
    activeOnly: true,
  });

  const selectedDateString = isoDate(selectedDate);
  const monthDays = useMemo(() => getMonthDays(selectedDate), [selectedDate]);

  const activeRooms = useMemo(() => {
    return (rooms ?? []).sort((a, b) => a.code.localeCompare(b.code));
  }, [rooms]);

  const bookingsForDay = useMemo(() => {
    return ((requests ?? []) as CalendarRequest[]).filter(
      (request) =>
        requestIsVisibleOnCalendar(request) &&
        request.blocks.some((block) => block.start.slice(0, 10) === selectedDateString)
    );
  }, [requests, selectedDateString]);

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
        <div className="mb-5 grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-950">
                {formatDateLabel(selectedDate)}
              </h2>
              <p className="text-sm text-slate-500">
                {bookingsForDay.length} pending/approved booking(s) ·{" "}
                {activeRooms.length} active room(s)
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedDate(addYears(selectedDate, -1))}
                className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm font-medium hover:bg-blue-50"
              >
                -1 year
              </button>

              <button
                type="button"
                onClick={() => setSelectedDate(addMonths(selectedDate, -1))}
                className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm font-medium hover:bg-blue-50"
              >
                -1 month
              </button>

              <button
                type="button"
                onClick={() => setSelectedDate(addDays(selectedDate, -1))}
                className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm font-medium hover:bg-blue-50"
                aria-label="Previous day"
              >
                <ChevronLeft className="size-4" />
              </button>

              <button
                type="button"
                onClick={() => setSelectedDate(startOfToday())}
                className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm font-semibold hover:bg-blue-50"
              >
                Today
              </button>

              <button
                type="button"
                onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm font-medium hover:bg-blue-50"
                aria-label="Next day"
              >
                <ChevronRight className="size-4" />
              </button>

              <button
                type="button"
                onClick={() => setSelectedDate(addMonths(selectedDate, 1))}
                className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm font-medium hover:bg-blue-50"
              >
                +1 month
              </button>

              <button
                type="button"
                onClick={() => setSelectedDate(addYears(selectedDate, 1))}
                className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm font-medium hover:bg-blue-50"
              >
                +1 year
              </button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">
              {formatMonthLabel(selectedDate)}
            </p>

            <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
              {monthDays.map((day) => {
                const dayString = isoDate(day);
                const isSelected = dayString === selectedDateString;
                const hasBooking = ((requests ?? []) as CalendarRequest[]).some(
                  (request) =>
                    requestIsVisibleOnCalendar(request) &&
                    request.blocks.some((block) => block.start.slice(0, 10) === dayString)
                );

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => setSelectedDate(day)}
                    className={`relative size-11 shrink-0 rounded-xl border text-sm font-semibold ${
                      isSelected
                        ? "border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                        : "border-blue-100 bg-white/82 text-slate-700 hover:bg-blue-50"
                    }`}
                    aria-pressed={isSelected}
                  >
                    {day.getDate()}
                    {hasBooking ? (
                      <span
                        className={`absolute bottom-1.5 left-1/2 size-1.5 -translate-x-1/2 rounded-full ${
                          isSelected ? "bg-white" : "bg-blue-600"
                        }`}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {rooms === undefined ? (
          <p className="rounded-xl border border-dashed border-blue-100 bg-white/60 p-4 text-sm text-slate-500">
            Loading rooms...
          </p>
        ) : activeRooms.length === 0 ? (
          <p className="rounded-xl border border-dashed border-blue-100 bg-white/60 p-4 text-sm text-slate-500">
            No active rooms configured yet. Add rooms in Admin → Rooms.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <div
              className="grid min-w-[1060px]"
              style={{
                gridTemplateColumns: `240px repeat(${hours.length}, minmax(82px, 1fr))`,
              }}
            >
              <div />

              {hours.map((hour) => (
                <div
                  key={hour}
                  className="border-b border-blue-100 p-2 text-center text-xs font-medium text-slate-500"
                >
                  {String(hour).padStart(2, "0")}:00
                </div>
              ))}

              {activeRooms.map((room) => {
                const roomBookings = bookingsForDay.filter((request) =>
                  requestUsesRoom(request, room._id)
                );

                return (
                  <div key={room._id} className="contents">
                    <div className="border-b border-blue-100 p-2 text-sm">
                      <p className="font-semibold text-slate-800">{room.code}</p>
                      <p className="text-xs text-slate-500">{room.name}</p>
                      <p className="text-xs text-slate-400">
                        {room.roomType?.name ?? "No type"} · cap {room.capacity}
                      </p>
                    </div>

                    <div
                      className="relative col-span-10 min-h-20 border-b border-l border-blue-100 bg-white/40"
                      style={{ gridColumn: `span ${hours.length}` }}
                    >
                      <div className="absolute inset-0 grid grid-cols-10">
                        {hours.map((hour) => (
                          <div
                            key={`${room._id}-line-${hour}`}
                            className="border-l border-blue-100 first:border-l-0"
                          />
                        ))}
                      </div>

                      {roomBookings.map((booking, bookingIndex) => {
                        const placement = getGridPlacement(booking.blocks);

                        return (
                          <a
                            key={booking._id}
                            href={`/dashboard/requests/${booking._id}`}
                            className={`absolute top-2 z-10 rounded-lg border px-2 py-1 text-xs shadow-sm ${bookingTone(
                              booking.status
                            )}`}
                            style={{
                              left: placement.left,
                              width: placement.width,
                              top: `${8 + bookingIndex * 42}px`,
                            }}
                            title={`${booking.sessionName} · ${placement.label}`}
                          >
                            <span className="block truncate font-semibold">
                              {booking.sessionName}
                            </span>
                            <span className="block truncate opacity-80">
                              {placement.label} · {booking.status}
                            </span>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
          <span className="rounded-full border border-slate-300 bg-slate-200 px-3 py-1">
            Pending
          </span>
          <span className="rounded-full border border-blue-600 bg-blue-600 px-3 py-1 text-white">
            Approved
          </span>
        </div>
      </Card>
    </>
  );
}