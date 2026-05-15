"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, SectionHeader, StatusPill } from "@/components/ui";
import { TENANT_SLUG } from "@/lib/config";
import { formatRooms } from "@/lib/format";

const days = Array.from({ length: 31 }, (_, index) => index + 1);
const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function PublicCalendar() {
  const [selectedDay, setSelectedDay] = useState(18);
  const [query, setQuery] = useState("");
  const events = useQuery(api.bookings.listPublicEvents, { tenantSlug: TENANT_SLUG, month: "2026-05" });

  const filteredMonthEvents = useMemo(() => {
    const requests = events ?? [];
    const term = query.trim().toLowerCase();
    if (!term) return requests;
    return requests.filter((request) =>
      [request.sessionName, request.requesterName, formatRooms(request)]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [events, query]);

  const dayEvents = filteredMonthEvents.filter((request) => request.blocks.some((block) => block.start.slice(8, 10) === String(selectedDay).padStart(2, "0")));
  const eventDays = new Set(filteredMonthEvents.flatMap((request) => request.blocks.map((block) => Number(block.start.slice(8, 10)))));

  return (
    <>
      <SectionHeader
        eyebrow="May 2026"
        title="Public Calendar"
        action={<Link href="/book" className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90">Book a Room</Link>}
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <label className="text-sm font-semibold text-foreground" htmlFor="calendar-search">Search within month</label>
          <input
            id="calendar-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Session, room, requester"
            className="mt-2 w-full rounded-xl border border-border bg-card/90 px-3 py-2 text-sm shadow-sm"
          />
          <div className="mt-5 grid max-w-2xl grid-cols-7 gap-2 text-center">
            {weekdayLabels.map((label) => <p key={label} className="text-xs font-semibold text-muted-foreground">{label}</p>)}
            {days.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`relative h-11 rounded-xl border text-sm transition sm:h-12 ${day === selectedDay ? "border-primary bg-primary font-bold text-primary-foreground shadow-lg shadow-primary/20" : "border-border bg-card/90 text-foreground hover:border-ring hover:bg-muted"}`}
                aria-pressed={day === selectedDay}
              >
                {day}
                {eventDays.has(day) ? <span className={`absolute bottom-2 left-1/2 size-1.5 -translate-x-1/2 rounded-full ${day === selectedDay ? "bg-card" : "bg-primary"}`} /> : null}
              </button>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="font-bold text-foreground">Selected day</h2>
          <p className="mt-1 text-sm text-muted-foreground">{selectedDay} May 2026</p>
          <div className="mt-4 grid gap-3">
            {dayEvents.length > 0 ? dayEvents.map((event) => (
              <div key={event._id} className="rounded-xl border border-border bg-card/80 p-3">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-foreground">{event.sessionName}</h3>
                  <StatusPill status={event.status} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{event.blocks.map((block) => `${block.label}: ${block.start.slice(11, 16)}-${block.end.slice(11, 16)}`).join(" · ")}</p>
                <p className="mt-1 text-sm text-muted-foreground">{formatRooms(event)}</p>
              </div>
            )) : <p className="rounded-xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">{events === undefined ? "Loading calendar..." : "No public sessions for this day."}</p>}
          </div>
        </Card>
      </div>
    </>
  );
}
