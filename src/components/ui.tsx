import Link from "next/link";
import type { ReactNode } from "react";
import { Bell, Building2, CalendarDays, ChevronRight, ClipboardList, LayoutDashboard, LifeBuoy, Settings2, ShieldCheck } from "lucide-react";
import clsx from "clsx";

export function PageShell({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">{children}</main>;
}

export function PublicNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-blue-100/80 bg-white/82 backdrop-blur-xl">
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="grid size-9 place-items-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">S</span>
          SimHub
        </Link>
        <div className="flex items-center gap-2 text-sm">
          <Link href="/calendar" className="rounded-lg px-3 py-2 font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700">Calendar</Link>
          <Link href="/book" className="rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700">Book a Room</Link>
          <a href="/auth/sign-in?returnTo=/dashboard" className="hidden rounded-lg px-3 py-2 font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 sm:inline-flex">Staff sign in</a>
        </div>
      </nav>
    </header>
  );
}

export function DashboardNav() {
  const items = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Requests", href: "/dashboard/requests", icon: ClipboardList },
    { label: "Calendar", href: "/dashboard/resource-calendar", icon: CalendarDays },
    { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
    {
      label: "Admin",
      href: "/dashboard/admin/facility",
      icon: Settings2,
      children: [
        { label: "Facility", href: "/dashboard/admin/facility" },
        { label: "Campuses", href: "/dashboard/admin/campuses"},
        { label: "Room Types", href: "/dashboard/admin/room-types" },
        { label: "Rooms", href: "/dashboard/admin/rooms" },
        { label: "Request Form", href: "/dashboard/admin/forms" },
        { label: "Accounts", href: "/dashboard/admin/accounts" },
      ],
    },
  ];

  return (
    <aside className="border-blue-100 bg-[#f3f7fc]/95 p-3 backdrop-blur-xl lg:fixed lg:inset-y-0 lg:left-0 lg:w-72 lg:border-r">
      <Link href="/dashboard" className="flex items-center gap-3 rounded-2xl px-2 py-3 text-base font-bold">
        <span className="grid size-10 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
          <ShieldCheck className="size-5" />
        </span>
        <span>
          SimHub Ops
          <span className="block text-xs font-medium text-slate-500">Simulation Centre</span>
        </span>
      </Link>
      <div className="mt-5 rounded-2xl border border-blue-100 bg-white/70 p-2 shadow-sm">
        <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Navigation</p>
        <nav className="grid gap-1 text-sm">
          {items.map((item) => (
            <div key={item.href}>
              <Link href={item.href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700">
                <item.icon className="size-4" />
                {item.label}
              </Link>
              {item.children ? (
                <div className="ml-8 mt-1 grid gap-1 border-l border-blue-100 pl-2">
                  {item.children.map((child) => (
                    <Link key={child.href} href={child.href} className="rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-blue-50 hover:text-blue-700">
                      {child.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </nav>
      </div>
      <div className="mt-4 rounded-2xl border border-blue-100 bg-white/70 p-4 text-sm shadow-sm">
        <div className="flex items-center gap-2 font-semibold text-slate-900">
          <Building2 className="size-4 text-blue-600" />
          Tenant workspace
        </div>
        <p className="mt-1 text-xs text-slate-500">Live Convex tenant</p>
      </div>
      <Link href="mailto:simulation@example.edu" className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-700">
        <LifeBuoy className="size-4" />
        Help desk
      </Link>
    </aside>
  );
}

export function DashboardTopbar({ title = "Operations" }: { title?: string }) {
  return (
    <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-blue-100/80 bg-white/82 px-4 py-3 backdrop-blur-xl lg:px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">SimHub</p>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/calendar" className="hidden rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-blue-50 sm:inline-flex">Public calendar</Link>
        <Link href="/book" className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700">New request</Link>
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
        <Link key={href} href={href} className="rounded-lg border border-blue-100 bg-white/80 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-blue-50 hover:text-blue-700">
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={clsx("app-surface rounded-2xl p-4", className)}>{children}</section>;
}

export function SectionHeader({ title, eyebrow, action }: { title: string; eyebrow?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <p className="text-sm font-semibold text-blue-600">{eyebrow}</p> : null}
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
      </div>
      {action}
    </div>
  );
}

export function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Card>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
      {detail ? <p className="mt-1 text-sm text-slate-500">{detail}</p> : null}
    </Card>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone = status === "Approved" ? "bg-emerald-50 text-emerald-700" : status === "Pending" ? "bg-amber-50 text-amber-700" : status === "Completed" ? "bg-blue-50 text-blue-700" : status === "Required" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-700";
  return <span className={clsx("rounded-full px-2.5 py-1 text-xs font-medium", tone)}>{status}</span>;
}

export function RequestCard({ request }: { request: { id: string; sessionName: string; requesterName: string; date: string; rooms: string[]; status: string } }) {
  return (
    <Link href={`/dashboard/requests/${request.id}`} className="block rounded-2xl border border-blue-100 bg-white/82 p-4 shadow-sm hover:border-blue-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{request.date} · {request.requesterName}</p>
          <h2 className="mt-1 font-semibold text-slate-950">{request.sessionName}</h2>
          <p className="mt-2 text-sm text-slate-600">{request.rooms.join(", ")}</p>
        </div>
        <StatusPill status={request.status} />
      </div>
    </Link>
  );
}

export function EmptyAction({ label, href }: { label: string; href: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 rounded-lg border border-blue-100 bg-white/90 px-3 py-2 text-sm font-medium shadow-sm hover:border-blue-300 hover:bg-blue-50">
      <CalendarDays className="size-4" /> {label} <ChevronRight className="size-4" />
    </Link>
  );
}
