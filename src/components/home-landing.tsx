"use client";

import Link from "next/link";
import { CalendarDays, ClipboardList, UsersRound } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, EmptyAction } from "@/components/ui";
import { TENANT_SLUG } from "@/lib/config";

const featureCards = [
  { title: "Public calendar", body: "Monthly search, day selection, and session lists.", Icon: CalendarDays },
  { title: "Request wizard", body: "Room quantities, setup/session/cleanup blocks, files up to 100 MB.", Icon: ClipboardList },
  { title: "Admin controls", body: "Roles, facility settings, rooms, request forms, and tenant setup.", Icon: UsersRound },
];

export function HomeLanding() {
  const tenant = useQuery(api.tenants.getBySlug, { slug: TENANT_SLUG });
  const hours = tenant?.hoursOfOperation ?? "Hours not configured";
  const contactEmail = tenant?.contactEmail ?? "simulation@example.edu";

  return (
    <section className="grid gap-8 py-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
      <div>
        <p className="text-sm font-medium text-blue-600">{hours}</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">SimHub</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
          A booking and operations workspace for simulation centres: public availability, structured room requests, staff approvals, notifications, and tenant administration.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/book" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700">Book a Room</Link>
          <EmptyAction href="/calendar" label="View public calendar" />
          <a href={`mailto:${contactEmail}`} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 hover:text-blue-600">Contact help</a>
        </div>
      </div>
      <div className="grid gap-3">
        {featureCards.map(({ title, body, Icon }) => (
          <Card key={title}>
            <Icon className="size-5 text-blue-600" />
            <h2 className="mt-3 font-semibold text-slate-950">{title}</h2>
            <p className="mt-1 text-sm text-slate-600">{body}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
