import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusVariant =
  | "active"
  | "inactive"
  | "pending"
  | "approved"
  | "confirmed"
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
      "bg-primary/10 text-primary border-border hover:bg-primary/10",
  },
  inactive: {
    label: "Inactive",
    className: "bg-muted text-muted-foreground border-border hover:bg-muted",
  },
  pending: {
    label: "Pending",
    className: "bg-primary/10 text-primary border-border hover:bg-primary/10",
  },
  approved: {
    label: "Approved",
    className:
      "bg-primary/10 text-primary border-border hover:bg-primary/10",
  },
  confirmed: {
    label: "Confirmed",
    className:
      "bg-primary/10 text-primary border-border hover:bg-primary/10",
  },
  declined: {
    label: "Declined",
    className: "bg-destructive/10 text-destructive border-border hover:bg-destructive/10",
  },
  completed: {
    label: "Completed",
    className: "bg-muted text-primary border-border hover:bg-muted",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-muted text-muted-foreground border-border hover:bg-muted",
  },
  special: {
    label: "Special",
    className:
      "bg-primary/10 text-primary border-border hover:bg-primary/10",
  },
  admin: {
    label: "Admin",
    className: "bg-muted text-primary border-border hover:bg-muted",
  },
  staff: {
    label: "Staff",
    className:
      "bg-primary/10 text-primary border-border hover:bg-primary/10",
  },
  requester: {
    label: "Requester",
    className: "bg-muted text-muted-foreground border-border hover:bg-muted",
  },
  required: {
    label: "Required",
    className: "bg-muted text-primary border-border hover:bg-muted",
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
        active ? "bg-primary/100" : "bg-muted-foreground/40"
      )}
      aria-hidden="true"
    />
  );
}
