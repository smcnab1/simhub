import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { AlertTriangle, ArrowRight, LoaderCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { subtleButtonClass } from "@/components/ui";
import { cn } from "@/lib/utils";

export function InlineSpinner({ label = "Loading..." }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
      <LoaderCircle className="size-4 animate-spin" aria-hidden />
      {label}
    </span>
  );
}

export function CardSkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="grid gap-3" aria-label="Loading content">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="rounded-xl border border-border bg-card/80 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-5 w-3/5" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MetricSkeletonGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-4" aria-label="Loading metrics">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="app-surface rounded-2xl p-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-8 w-14" />
          <Skeleton className="mt-2 h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
  className,
}: {
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  message: string;
  action?: { label: string; href: string };
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-dashed border-border bg-muted/40 p-6 text-center", className)}>
      {Icon ? <Icon className="mx-auto mb-3 size-8 text-muted-foreground" aria-hidden /> : null}
      <p className="font-medium text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{message}</p>
      {action ? (
        <Link href={action.href} className={cn(subtleButtonClass, "mt-4 gap-2")}>
          {action.label}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

export function InlineError({
  title = "We could not complete that action",
  message,
  children,
}: {
  title?: string;
  message: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
      <div className="flex gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div>
          <p className="font-medium">{title}</p>
          <p className="mt-1 text-destructive/90">{message}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
