import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import type { ReactNode } from "react";

interface AdminSettingsCardProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** If true, removes internal padding from children */
  noPadding?: boolean;
}

export function AdminSettingsCard({
  title,
  description,
  icon,
  children,
  footer,
  className,
  noPadding = false,
}: AdminSettingsCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card shadow-sm overflow-hidden",
        className
      )}
    >
      <div className="px-6 py-5 flex items-start gap-3">
        {icon && (
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground leading-none">
            {title}
          </h3>
          {description && (
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>

      <Separator />

      <div className={cn(!noPadding && "px-6 py-5")}>{children}</div>

      {footer && (
        <>
          <Separator />
          <div className="px-6 py-4 bg-muted/30">{footer}</div>
        </>
      )}
    </div>
  );
}

interface AdminSettingsRowProps {
  label: string;
  description?: string;
  children: ReactNode;
  className?: string;
  /** Stack vertically on all screens */
  stacked?: boolean;
}

export function AdminSettingsRow({
  label,
  description,
  children,
  className,
  stacked = false,
}: AdminSettingsRowProps) {
  return (
    <div
      className={cn(
        "flex gap-4 py-4 first:pt-0 last:pb-0 border-b border-border/50 last:border-0",
        stacked ? "flex-col" : "flex-col sm:flex-row sm:items-start",
        className
      )}
    >
      <div className={cn("flex flex-col gap-0.5", !stacked && "sm:w-64 sm:shrink-0")}>
        <span className="text-sm font-medium text-foreground">{label}</span>
        {description && (
          <span className="text-xs text-muted-foreground leading-relaxed">
            {description}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
