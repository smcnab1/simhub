import { AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shown when a request has stored conflict metadata indicating real conflicts
 * (non-informational severity).
 */
export function RequestConflictBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive",
        className
      )}
      title="This request has scheduling conflicts"
      aria-label="Scheduling conflict"
    >
      <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
      Conflict
    </span>
  );
}

/**
 * Shown when a request has no assigned rooms and is in a status that
 * requires room allocation (Pending or Approved).
 */
export function RequestUnallocatedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400",
        className
      )}
      title="No rooms have been allocated to this request"
      aria-label="Unallocated — no rooms assigned"
    >
      <Clock className="size-3 shrink-0" aria-hidden="true" />
      Unallocated
    </span>
  );
}

/**
 * Shown when allocationStatus is ManualReviewRequired or Conflict.
 */
export function RequestNeedsAttentionBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400",
        className
      )}
      title="This request needs staff attention"
      aria-label="Needs staff attention"
    >
      <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
      Needs attention
    </span>
  );
}
