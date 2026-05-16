"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import { Card, SectionHeader, emptyStateClass, subtleButtonClass } from "@/components/ui";
import { TENANT_SLUG } from "@/lib/config";
import { localDateString } from "@/lib/date-time";
import { formatTimeRange } from "@/lib/format";

type PublicEvent = FunctionReturnType<typeof api.bookings.listPublicEvents>[number];

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatMonth(date = new Date()) {
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
  ].join("-");
}

function normalizeMonth(month?: string) {
  return month && monthPattern.test(month) ? month : formatMonth();
}

function addMonths(month: string, amount: number) {
  const [year, monthIndex] = month.split("-").map(Number);
  return formatMonth(new Date(year, monthIndex - 1 + amount, 1));
}

function monthDate(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Date(year, monthIndex - 1, 1);
}

function monthLabel(month: string) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(monthDate(month));
}

function dayLabel(day: string) {
  const date = new Date(`${day}T12:00:00`);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

function firstSessionDate(event: PublicEvent) {
  const session = event.blocks.find((block) => block.label === "Session");
  const first = session ?? event.blocks[0];
  return first ? localDateString(first.start, event.timezone) : "";
}

function sessionBlock(event: PublicEvent) {
  return event.blocks.find((block) => block.label === "Session") ?? event.blocks[0];
}

function firstStartMs(event: PublicEvent) {
  const first = sessionBlock(event)?.start;
  return first ? Date.parse(first) : Number.POSITIVE_INFINITY;
}

function roomText(event: PublicEvent) {
  if (!event.assignedRooms.length) return "";
  return event.assignedRooms
    .map((room) => (room.code ? `${room.name} (${room.code})` : room.name))
    .join(", ");
}

function PublicEventCard({ event }: { event: PublicEvent }) {
  const rooms = roomText(event);
  const session = sessionBlock(event);

  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-foreground">{event.sessionName}</h3>
          {session ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {formatTimeRange(session.start, session.end, event.timezone)}
            </p>
          ) : null}
        </div>
        {rooms ? (
          <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm font-medium text-foreground sm:max-w-64">
            {rooms}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function PublicCalendar({
  tenantSlug = TENANT_SLUG,
  initialMonth,
}: {
  tenantSlug?: string;
  initialMonth?: string;
}) {
  const [month, setMonth] = useState(() => normalizeMonth(initialMonth));
  const [selectedDay, setSelectedDay] = useState(() => {
    const initial = normalizeMonth(initialMonth);
    const today = formatMonth() === initial ? new Date().getDate() : 1;
    return `${initial}-${String(today).padStart(2, "0")}`;
  });
  const [query, setQuery] = useState("");
  const events = useQuery(api.bookings.listPublicEvents, { tenantSlug, month });

  const days = useMemo(() => {
    const date = monthDate(month);
    const firstWeekday = (date.getDay() + 6) % 7;
    const totalDays = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

    return [
      ...Array.from({ length: firstWeekday }, () => null),
      ...Array.from({ length: totalDays }, (_, index) => {
        const day = String(index + 1).padStart(2, "0");
        return `${month}-${day}`;
      }),
    ];
  }, [month]);

  const filteredEvents = useMemo(() => {
    const term = query.trim().toLowerCase();
    const ordered = [...(events ?? [])].sort((a, b) => firstStartMs(a) - firstStartMs(b));
    if (!term) return ordered;

    return ordered.filter((event) =>
      [event.sessionName, roomText(event)].join(" ").toLowerCase().includes(term)
    );
  }, [events, query]);

  const eventsByDay = useMemo(() => {
    const grouped = new Map<string, PublicEvent[]>();

    for (const event of filteredEvents) {
      const day = firstSessionDate(event);
      const current = grouped.get(day) ?? [];
      current.push(event);
      grouped.set(day, current);
    }

    return grouped;
  }, [filteredEvents]);

  const isLoading = events === undefined;
  const selectedEvents = selectedDay.startsWith(month)
    ? eventsByDay.get(selectedDay) ?? []
    : [];
  const selectedDateLabel = selectedDay.startsWith(month)
    ? dayLabel(selectedDay)
    : monthLabel(month);

  function showMonth(nextMonth: string) {
    setMonth(nextMonth);
    setSelectedDay(`${nextMonth}-01`);
  }

  return (
    <>
      <SectionHeader
        eyebrow="Approved simulation activity"
        title="Public Activity"
        action={
          <Link href="/book" className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90">
            Book a Room
          </Link>
        }
      />

      <Card className="mb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Showing</p>
            <h2 className="mt-1 text-2xl font-bold text-foreground">{monthLabel(month)}</h2>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search activity or room"
                className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm shadow-sm transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-64"
                aria-label="Search approved public activity"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => showMonth(addMonths(month, -1))}
                className={`${subtleButtonClass} gap-2`}
                aria-label="Show previous month"
              >
                <ChevronLeft className="size-4" />
                Previous
              </button>
              <button
                type="button"
                onClick={() => showMonth(addMonths(month, 1))}
                className={`${subtleButtonClass} gap-2`}
                aria-label="Show next month"
              >
                Next
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="p-3 sm:p-4">
          {isLoading ? (
            <div className={emptyStateClass}>Loading approved activity...</div>
          ) : (
            <>
              {filteredEvents.length === 0 ? (
                <div className="mb-4 rounded-xl border border-dashed border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                  {query.trim()
                    ? "No approved activity matches that search for this month."
                    : "No approved activity is scheduled for this month."}
                </div>
              ) : null}

              <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
                {weekdayLabels.map((label) => (
                  <div key={label} className="bg-muted px-2 py-2 text-center text-xs font-semibold uppercase text-muted-foreground">
                    {label}
                  </div>
                ))}
                {days.map((day, index) => {
                  const dayEvents = day ? eventsByDay.get(day) ?? [] : [];
                  const isSelected = day === selectedDay;

                  return day ? (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setSelectedDay(day)}
                      className={`relative flex aspect-square min-h-14 flex-col items-center justify-center bg-card text-sm font-semibold transition hover:bg-muted focus-visible:z-10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-20 ${
                        isSelected ? "text-primary ring-2 ring-inset ring-primary" : "text-foreground"
                      }`}
                      aria-pressed={isSelected}
                      aria-label={`${dayLabel(day)}${dayEvents.length ? `, ${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}` : ""}`}
                    >
                      <span>{Number(day.slice(8, 10))}</span>
                      {dayEvents.length ? (
                        <span className="mt-1 flex items-center gap-1">
                          <span className="size-1.5 rounded-full bg-primary" />
                          {dayEvents.length > 1 ? (
                            <span className="text-[11px] font-medium text-muted-foreground">{dayEvents.length}</span>
                          ) : null}
                        </span>
                      ) : null}
                    </button>
                  ) : (
                    <div key={`blank-${index}`} className="aspect-square min-h-14 bg-muted/40 sm:min-h-20" />
                  );
                })}
              </div>
            </>
          )}
        </Card>

        <Card className="self-start">
          <p className="text-sm font-medium text-muted-foreground">Selected date</p>
          <h2 className="mt-1 text-xl font-bold text-foreground">{selectedDateLabel}</h2>
          <div className="mt-4 grid gap-3">
            {isLoading ? (
              <div className={emptyStateClass}>Loading events...</div>
            ) : selectedEvents.length > 0 ? (
              selectedEvents.map((event) => (
                <PublicEventCard key={event._id} event={event} />
              ))
            ) : (
              <div className={emptyStateClass}>
                {query.trim()
                  ? "No matching approved activity for this date."
                  : "No approved activity for this date."}
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
