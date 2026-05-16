"use client";

import Link from "next/link";
import { CalendarDays, ClipboardList, UsersRound } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, EmptyAction } from "@/components/ui";
import { APP_NAME, TENANT_SLUG } from "@/lib/config";

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
        <p className="text-sm font-medium text-primary">{hours}</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">{APP_NAME}</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
          A booking and operations workspace for simulation centres: public availability, structured room requests, staff approvals, notifications, and tenant administration.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/book" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90">Book a Room</Link>
          <EmptyAction href="/calendar" label="View public calendar" />
          <a href={`mailto:${contactEmail}`} className="rounded-xl px-4 py-2.5 text-sm font-medium text-foreground hover:text-primary">Contact help</a>
        </div>
      </div>
      <div className="grid gap-3">
        {featureCards.map(({ title, body, Icon }) => (
          <Card key={title}>
            <Icon className="size-5 text-primary" />
            <h2 className="mt-3 font-semibold text-foreground">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
