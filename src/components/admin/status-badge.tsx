import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusVariant =
  | "active"
  | "inactive"
  | "pending"
  | "approved"
  | "declined"
  | "completed"
  | "cancelled"
  | "special"
  | "admin"
  | "staff"
  | "requester"
  | "required"
  | "optional";

const variantMap: Record<StatusVariant, { label: string; className: string }> = {
  active: {
    label: "Active",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50",
  },
  inactive: {
    label: "Inactive",
    className: "bg-muted text-muted-foreground border-border hover:bg-muted",
  },
  pending: {
    label: "Pending",
    className: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50",
  },
  approved: {
    label: "Approved",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50",
  },
  declined: {
    label: "Declined",
    className: "bg-red-50 text-red-700 border-red-200 hover:bg-red-50",
  },
  completed: {
    label: "Completed",
    className: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-muted text-muted-foreground border-border hover:bg-muted",
  },
  special: {
    label: "Special",
    className:
      "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-50",
  },
  admin: {
    label: "Admin",
    className: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50",
  },
  staff: {
    label: "Staff",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50",
  },
  requester: {
    label: "Requester",
    className: "bg-muted text-muted-foreground border-border hover:bg-muted",
  },
  required: {
    label: "Required",
    className: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50",
  },
  optional: {
    label: "Optional",
    className: "bg-muted text-muted-foreground border-border hover:bg-muted",
  },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const key = status.toLowerCase() as StatusVariant;
  const config = variantMap[key];

  if (!config) {
    return (
      <Badge variant="outline" className={className}>
        {status}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(config.className, "text-[11px] font-medium", className)}
    >
      {config.label}
    </Badge>
  );
}

/** Dot indicator for status */
export function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-block size-2 rounded-full",
        active ? "bg-emerald-500" : "bg-muted-foreground/40"
      )}
      aria-hidden="true"
    />
  );
}
