import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarDays, ChevronRight } from "lucide-react";
import clsx from "clsx";
import { ThemeToggle } from "@/components/theme-toggle";

export const pageWrapClass = "mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8";
export const sectionCardClass = "app-surface rounded-2xl p-4";
export const adminPanelClass = "rounded-xl border border-border bg-card text-card-foreground shadow-sm";
export const tableContainerClass = "overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm";
export const statCardClass = "app-surface rounded-2xl p-4";
export const formFieldClass = "mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground";
export const subtleButtonClass = "inline-flex items-center justify-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50";
export const primaryButtonClass = "inline-flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60";
export const emptyStateClass = "rounded-2xl border border-dashed border-border bg-muted/40 p-5 text-sm text-muted-foreground";

export function PageShell({ children }: { children: ReactNode }) {
  return <main className={pageWrapClass}>{children}</main>;
}

export function PublicNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-card/90 backdrop-blur-xl">
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">S</span>
          SimHub
        </Link>
        <div className="flex items-center gap-2 text-sm">
          <Link href="/calendar" className="rounded-lg px-3 py-2 font-medium text-foreground hover:bg-muted hover:text-primary">Calendar</Link>
          <Link href="/book" className="rounded-lg bg-primary px-3 py-2 font-semibold text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90">Book a Room</Link>
          <a href="/auth/sign-in?returnTo=/dashboard" className="hidden rounded-lg px-3 py-2 font-medium text-foreground hover:bg-muted hover:text-primary sm:inline-flex">Staff sign in</a>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}

export function DashboardTopbar({ title = "Operations" }: { title?: string }) {
  return (
    <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-border/80 bg-card/90 px-4 py-3 backdrop-blur-xl lg:px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">SimHub</p>
        <p className="text-sm font-semibold text-foreground">{title}</p>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/calendar" className="hidden rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted sm:inline-flex">Public calendar</Link>
        <Link href="/book" className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90">New request</Link>
        <ThemeToggle />
      </div>
    </header>
  );
}

export function AdminMenu() {
  const items = [
    ["Facility", "/dashboard/admin/facility"],
    ["Campuses", "/dashboard/admin/campuses"],
    ["Room Types", "/dashboard/admin/room-types"],
    ["Rooms", "/dashboard/admin/rooms"],
    ["Request Form", "/dashboard/admin/forms"],
    ["Accounts", "/dashboard/admin/accounts"],
  ];

  return (
    <nav className="mb-5 flex flex-wrap gap-2">
      {items.map(([label, href]) => (
        <Link key={href} href={href} className="rounded-lg border border-border bg-card/80 px-3 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted hover:text-primary">
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={clsx(sectionCardClass, className)}>{children}</section>;
}

export function SectionHeader({ title, eyebrow, action }: { title: string; eyebrow?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <p className="text-sm font-semibold text-primary">{eyebrow}</p> : null}
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
      </div>
      {action}
    </div>
  );
}

export function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Card className={statCardClass}>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
      {detail ? <p className="mt-1 text-sm text-muted-foreground">{detail}</p> : null}
    </Card>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone = status === "Declined" || status === "Cancelled"
    ? "bg-destructive/10 text-destructive"
    : status === "Pending" || status === "Required"
      ? "bg-muted text-foreground"
      : "bg-primary/10 text-primary";
  return <span className={clsx("rounded-full border border-border px-2.5 py-1 text-xs font-medium", tone)}>{status}</span>;
}

export function RequestCard({ request }: { request: { id: string; sessionName: string; requesterName: string; date: string; rooms: string[]; status: string } }) {
  return (
    <Link href={`/dashboard/requests/${request.id}`} className="block rounded-2xl border border-border bg-card/90 p-4 shadow-sm transition hover:border-ring hover:bg-muted/40 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{request.date} · {request.requesterName}</p>
          <h2 className="mt-1 font-semibold text-foreground">{request.sessionName}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{request.rooms.join(", ")}</p>
        </div>
        <StatusPill status={request.status} />
      </div>
    </Link>
  );
}

export function EmptyAction({ label, href }: { label: string; href: string }) {
  return (
    <Link href={href} className={clsx(subtleButtonClass, "gap-2 hover:border-ring")}>
      <CalendarDays className="size-4" /> {label} <ChevronRight className="size-4" />
    </Link>
  );
}
