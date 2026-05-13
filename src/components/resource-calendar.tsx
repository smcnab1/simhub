"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, SectionHeader } from "@/components/ui";
import { TENANT_SLUG } from "@/lib/config";

const days = Array.from({ length: 31 }, (_, index) => index + 1);
const resources = ["WB-C", "CTRL-2", "CS-1", "CS-2", "Online"];
const hours = ["08", "09", "10", "11", "12", "13", "14", "15", "16", "17"];

export function ResourceCalendar() {
  const [selectedDay, setSelectedDay] = useState(18);
  const requests = useQuery(api.bookings.listRequests, { tenantSlug: TENANT_SLUG });
  const approvedForDay = (requests ?? []).filter((request) => request.status === "Approved" && request.blocks.some((block) => block.start.slice(8, 10) === String(selectedDay).padStart(2, "0")));

  return (
    <>
      <SectionHeader
        title="Resource Calendar"
        eyebrow="Operations"
        action={<div className="flex gap-2"><button className="rounded-lg border border-blue-100 bg-white/90 px-3 py-2 text-sm font-medium shadow-sm hover:bg-blue-50">Block Time</button><button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700">Add booking</button></div>}
      />
      <Card>
        <div className="mb-5 flex max-w-full gap-2 overflow-x-auto pb-1">
          {days.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={`size-10 shrink-0 rounded-xl border text-sm font-semibold ${day === selectedDay ? "border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "border-blue-100 bg-white/82 text-slate-700 hover:bg-blue-50"}`}
              aria-pressed={day === selectedDay}
            >
              {day}
            </button>
          ))}
        </div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold text-slate-950">{selectedDay} May 2026</h2>
          <p className="text-sm text-slate-500">{approvedForDay.length} approved session(s)</p>
        </div>
        <div className="overflow-x-auto">
          <div className="grid min-w-[820px]" style={{ gridTemplateColumns: `120px repeat(${hours.length}, minmax(64px, 1fr))` }}>
            <div />
            {hours.map((hour) => <div key={hour} className="border-b border-blue-100 p-2 text-center text-xs font-medium text-slate-500">{hour}:00</div>)}
            {resources.map((resource) => (
              <div key={resource} className="contents">
                <div className="border-b border-blue-100 p-2 text-sm font-semibold text-slate-800">{resource}</div>
                {hours.map((hour) => <button type="button" key={`${resource}-${hour}`} className="h-14 border-b border-l border-blue-100 bg-white/40 transition hover:bg-blue-50" aria-label={`${resource} ${hour}:00 on ${selectedDay} May`} />)}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-2">
          {approvedForDay.map((request) => <p key={request._id} className="rounded-xl border border-blue-100 bg-white/70 p-3 text-sm font-medium text-slate-700">{request.sessionName}</p>)}
        </div>
      </Card>
    </>
  );
}
