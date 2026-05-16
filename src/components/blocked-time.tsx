"use client";

import { useState, useMemo } from "react";
import {
  Ban,
  Building2,
  Calendar,
  DoorOpen,
  Globe,
  Layers,
  X,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useDashboardAuth } from "@/components/dashboard-auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BlockedTimeScope = "Room" | "RoomType" | "Campus" | "Tenant";

export type BlockedTimeFormData = {
  scope: BlockedTimeScope;
  roomId?: Id<"rooms">;
  roomTypeId?: Id<"roomTypes">;
  campusId?: Id<"campuses">;
  startDate: Date;
  startTime: string;
  endDate: Date;
  endTime: string;
  reason: string;
  notes?: string;
};

// ─── Scope Badge ──────────────────────────────────────────────────────────────

const scopeConfig: Record<
  BlockedTimeScope,
  { label: string; icon: React.ElementType; className: string }
> = {
  Room: {
    label: "Room",
    icon: DoorOpen,
    className: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  },
  RoomType: {
    label: "Room Type",
    icon: Layers,
    className: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  },
  Campus: {
    label: "Campus",
    icon: Building2,
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  Tenant: {
    label: "Tenant-wide",
    icon: Globe,
    className: "bg-red-500/10 text-red-700 dark:text-red-400",
  },
};

export function BlockedTimeScopeBadge({
  scope,
  targetName,
}: {
  scope: BlockedTimeScope;
  targetName?: string;
}) {
  const config = scopeConfig[scope];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        config.className
      )}
    >
      <Icon className="size-3" />
      {targetName ?? config.label}
    </span>
  );
}

// ─── Helper functions ─────────────────────────────────────────────────────────

function formatDateForInput(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatTimeForInput(date: Date): string {
  return date.toTimeString().slice(0, 5);
}

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const sameDay = startDate.toDateString() === endDate.toDateString();

  const dateFormatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  });
  const timeFormatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (sameDay) {
    return `${dateFormatter.format(startDate)} ${timeFormatter.format(startDate)} - ${timeFormatter.format(endDate)}`;
  }

  return `${dateFormatter.format(startDate)} ${timeFormatter.format(startDate)} - ${dateFormatter.format(endDate)} ${timeFormatter.format(endDate)}`;
}

function combineDateAndTime(date: Date, time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const combined = new Date(date);
  combined.setHours(hours, minutes, 0, 0);
  return combined.toISOString();
}

// ─── Room/RoomType/Campus type definitions ────────────────────────────────────

type Room = {
  _id: Id<"rooms">;
  code: string;
  name: string;
  active: boolean;
};

type RoomType = {
  _id: Id<"roomTypes">;
  name: string;
  active: boolean;
};

type Campus = {
  _id: Id<"campuses">;
  name: string;
  active?: boolean;
};

// ─── Blocked Time Form ────────────────────────────────────────────────────────

export function BlockedTimeForm({
  tenantId,
  onSuccess,
  onCancel,
  initialData,
}: {
  tenantId: Id<"tenants">;
  onSuccess?: () => void;
  onCancel?: () => void;
  initialData?: Partial<BlockedTimeFormData>;
}) {
  const auth = useDashboardAuth();
  const tenantSlug = auth.tenantSlug;
  
  const createBlockedTime = useMutation(api.blockedTimes.createBlockedTime);

  // Fetch options for selectors using existing tenant API patterns
  const rooms = useQuery(api.tenants.listPrivateRooms, {
    tenantSlug,
    auth,
    activeOnly: false,
  });
  const roomTypes = useQuery(api.tenants.listPrivateRoomTypes, {
    tenantSlug,
    auth,
    activeOnly: false,
  });
  const campuses = useQuery(api.tenants.listPrivateCampuses, {
    tenantSlug,
    auth,
    activeOnly: false,
  });

  // Form state
  const [scope, setScope] = useState<BlockedTimeScope>(
    initialData?.scope ?? "Room"
  );
  const [roomId, setRoomId] = useState<Id<"rooms"> | undefined>(
    initialData?.roomId
  );
  const [roomTypeId, setRoomTypeId] = useState<Id<"roomTypes"> | undefined>(
    initialData?.roomTypeId
  );
  const [campusId, setCampusId] = useState<Id<"campuses"> | undefined>(
    initialData?.campusId
  );

  const now = new Date();
  const defaultStartDate = initialData?.startDate ?? now;
  const defaultEndDate =
    initialData?.endDate ?? new Date(now.getTime() + 60 * 60 * 1000);

  const [startDate, setStartDate] = useState<Date>(defaultStartDate);
  const [startTime, setStartTime] = useState(
    initialData?.startTime ?? formatTimeForInput(defaultStartDate)
  );
  const [endDate, setEndDate] = useState<Date>(defaultEndDate);
  const [endTime, setEndTime] = useState(
    initialData?.endTime ?? formatTimeForInput(defaultEndDate)
  );
  const [reason, setReason] = useState(initialData?.reason ?? "");
  const [notes, setNotes] = useState(initialData?.notes ?? "");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  // Reset target when scope changes
  const handleScopeChange = (newScope: BlockedTimeScope) => {
    setScope(newScope);
    setRoomId(undefined);
    setRoomTypeId(undefined);
    setCampusId(undefined);
  };

  // Validation
  const validation = useMemo(() => {
    const errors: string[] = [];

    if (!reason.trim()) {
      errors.push("Reason is required");
    }

    const startDateTime = combineDateAndTime(startDate, startTime);
    const endDateTime = combineDateAndTime(endDate, endTime);

    if (new Date(endDateTime) <= new Date(startDateTime)) {
      errors.push("End time must be after start time");
    }

    if (scope === "Room" && !roomId) {
      errors.push("Room is required for Room scope");
    }
    if (scope === "RoomType" && !roomTypeId) {
      errors.push("Room type is required for Room Type scope");
    }
    if (scope === "Campus" && !campusId) {
      errors.push("Campus is required for Campus scope");
    }

    return { valid: errors.length === 0, errors };
  }, [scope, roomId, roomTypeId, campusId, startDate, startTime, endDate, endTime, reason]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validation.valid) {
      setError(validation.errors[0]);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const startDateTime = combineDateAndTime(startDate, startTime);
      const endDateTime = combineDateAndTime(endDate, endTime);

      await createBlockedTime({
        tenantSlug,
        auth,
        scope,
        roomId: scope === "Room" ? roomId : undefined,
        roomTypeId: scope === "RoomType" ? roomTypeId : undefined,
        campusId: scope === "Campus" ? campusId : undefined,
        start: startDateTime,
        end: endDateTime,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
      });

      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create blocked time");
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeRooms = (rooms as Room[] | undefined)?.filter((r) => r.active) ?? [];
  const activeRoomTypes = (roomTypes as RoomType[] | undefined)?.filter((rt) => rt.active) ?? [];
  const activeCampuses = (campuses as Campus[] | undefined)?.filter((c) => c.active !== false) ?? [];

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="size-4" />
          {error}
        </div>
      )}

      {/* Scope selector */}
      <div className="space-y-2">
        <Label htmlFor="scope">Block Scope</Label>
        <Select value={scope} onValueChange={(v) => handleScopeChange(v as BlockedTimeScope)}>
          <SelectTrigger id="scope">
            <SelectValue placeholder="Select scope" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Room">
              <span className="flex items-center gap-2">
                <DoorOpen className="size-4" />
                Specific Room
              </span>
            </SelectItem>
            <SelectItem value="RoomType">
              <span className="flex items-center gap-2">
                <Layers className="size-4" />
                Room Type (all rooms of type)
              </span>
            </SelectItem>
            <SelectItem value="Campus">
              <span className="flex items-center gap-2">
                <Building2 className="size-4" />
                Campus (all rooms in campus)
              </span>
            </SelectItem>
            <SelectItem value="Tenant">
              <span className="flex items-center gap-2">
                <Globe className="size-4" />
                Tenant-wide (all rooms)
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {scope === "Room" && "Block a specific room from being booked."}
          {scope === "RoomType" && "Block all rooms of a specific type."}
          {scope === "Campus" && "Block all rooms in a campus/site."}
          {scope === "Tenant" && "Block all rooms across the entire organization."}
        </p>
      </div>

      {/* Target selector based on scope */}
      {scope === "Room" && (
        <div className="space-y-2">
          <Label htmlFor="room">Room</Label>
          <Select
            value={roomId}
            onValueChange={(v) => setRoomId(v as Id<"rooms">)}
          >
            <SelectTrigger id="room">
              <SelectValue placeholder="Select room" />
            </SelectTrigger>
            <SelectContent>
              {activeRooms.map((room) => (
                <SelectItem key={room._id} value={room._id}>
                  {room.code} - {room.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {scope === "RoomType" && (
        <div className="space-y-2">
          <Label htmlFor="roomType">Room Type</Label>
          <Select
            value={roomTypeId}
            onValueChange={(v) => setRoomTypeId(v as Id<"roomTypes">)}
          >
            <SelectTrigger id="roomType">
              <SelectValue placeholder="Select room type" />
            </SelectTrigger>
            <SelectContent>
              {activeRoomTypes.map((rt) => (
                <SelectItem key={rt._id} value={rt._id}>
                  {rt.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {scope === "Campus" && (
        <div className="space-y-2">
          <Label htmlFor="campus">Campus</Label>
          <Select
            value={campusId}
            onValueChange={(v) => setCampusId(v as Id<"campuses">)}
          >
            <SelectTrigger id="campus">
              <SelectValue placeholder="Select campus" />
            </SelectTrigger>
            <SelectContent>
              {activeCampuses.map((campus) => (
                <SelectItem key={campus._id} value={campus._id}>
                  {campus.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Date/time range */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Start</Label>
          <div className="flex gap-2">
            <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
              <PopoverTrigger>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "flex-1 justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 size-4" />
                  {startDate ? formatDateForInput(startDate) : "Pick date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => {
                    if (date) {
                      setStartDate(date);
                      // If end date is before start date, update it
                      if (date > endDate) {
                        setEndDate(date);
                      }
                    }
                    setStartDateOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-28"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>End</Label>
          <div className="flex gap-2">
            <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
              <PopoverTrigger>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "flex-1 justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 size-4" />
                  {endDate ? formatDateForInput(endDate) : "Pick date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker
                  mode="single"
                  selected={endDate}
                  onSelect={(date) => {
                    if (date) setEndDate(date);
                    setEndDateOpen(false);
                  }}
                  disabled={(date) => date < startDate}
                />
              </PopoverContent>
            </Popover>
            <Input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-28"
            />
          </div>
        </div>
      </div>

      {/* Reason */}
      <div className="space-y-2">
        <Label htmlFor="reason">Reason</Label>
        <Input
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g., Maintenance, Holiday, Private event"
          required
        />
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional details..."
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting || !validation.valid}>
          {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
          Block Time
        </Button>
      </div>
    </form>
  );
}

// ─── Blocked Time Dialog ──────────────────────────────────────────────────────

export function BlockedTimeDialog({
  tenantId,
  open,
  onOpenChange,
  initialData,
}: {
  tenantId: Id<"tenants">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Partial<BlockedTimeFormData>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="size-5 text-destructive" />
            Block Time
          </DialogTitle>
          <DialogDescription>
            Block rooms or resources from being booked during a specific time period.
          </DialogDescription>
        </DialogHeader>
        <BlockedTimeForm
          tenantId={tenantId}
          initialData={initialData}
          onSuccess={() => onOpenChange(false)}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

// ─── Blocked Time List Item ───────────────────────────────────────────────────

type BlockedTimeListItem = {
  _id: Id<"blockedTimes">;
  scope: BlockedTimeScope;
  start: string;
  end: string;
  reason: string;
  notes?: string;
  status?: "Active" | "Cancelled";
  roomName?: string;
  roomTypeName?: string;
  campusName?: string;
  createdByName?: string;
};

export function BlockedTimeCard({
  blockedTime,
  onCancel,
}: {
  blockedTime: BlockedTimeListItem;
  onCancel?: (id: Id<"blockedTimes">) => void;
}) {
  const [isCancelling, setIsCancelling] = useState(false);

  const targetName =
    blockedTime.roomName ??
    blockedTime.roomTypeName ??
    blockedTime.campusName ??
    undefined;

  const isPast = new Date(blockedTime.end) < new Date();
  const isCancelled = blockedTime.status === "Cancelled";

  const handleCancel = async () => {
    if (!onCancel) return;
    setIsCancelling(true);
    try {
      await onCancel(blockedTime._id);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-3 rounded-lg border p-4 transition-colors",
        isCancelled
          ? "border-border/50 bg-muted/30 opacity-60"
          : isPast
            ? "border-border bg-muted/20"
            : "border-border bg-card hover:border-primary/30"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <BlockedTimeScopeBadge scope={blockedTime.scope} targetName={targetName} />
            {isCancelled && (
              <Badge variant="outline" className="text-muted-foreground">
                Cancelled
              </Badge>
            )}
            {isPast && !isCancelled && (
              <Badge variant="outline" className="text-muted-foreground">
                Past
              </Badge>
            )}
          </div>
          <p className="font-medium text-foreground">{blockedTime.reason}</p>
          {blockedTime.notes && (
            <p className="text-sm text-muted-foreground">{blockedTime.notes}</p>
          )}
        </div>

        {!isCancelled && !isPast && onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={handleCancel}
            disabled={isCancelling}
            aria-label="Cancel blocked time"
          >
            {isCancelling ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <X className="size-4" />
            )}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Calendar className="size-3.5" />
          {formatDateRange(blockedTime.start, blockedTime.end)}
        </span>
        {blockedTime.createdByName && (
          <span className="text-xs">by {blockedTime.createdByName}</span>
        )}
      </div>
    </div>
  );
}

// ─── Blocked Time List ────────────────────────────────────────────────────────

export function BlockedTimeList({
  tenantId,
  onCancel,
}: {
  tenantId: Id<"tenants">;
  onCancel?: (id: Id<"blockedTimes">) => void;
}) {
  const blockedTimes = useQuery(api.blockedTimes.listBlockedTimes, {
    tenantId,
    includeAllStatuses: true,
  });

  if (!blockedTimes) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (blockedTimes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 py-12 text-center">
        <Ban className="size-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No blocked times</p>
        <p className="text-xs text-muted-foreground">
          Block times to prevent rooms from being booked during specific periods.
        </p>
      </div>
    );
  }

  // Group by status: Active first, then Cancelled
  const activeBlocks = blockedTimes.filter(
    (bt) => (bt.status ?? "Active") === "Active"
  );
  const cancelledBlocks = blockedTimes.filter(
    (bt) => bt.status === "Cancelled"
  );

  return (
    <div className="space-y-6">
      {activeBlocks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            Active ({activeBlocks.length})
          </h3>
          <div className="grid gap-3">
            {activeBlocks.map((bt) => (
              <BlockedTimeCard
                key={bt._id}
                blockedTime={bt as BlockedTimeListItem}
                onCancel={onCancel}
              />
            ))}
          </div>
        </div>
      )}

      {cancelledBlocks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Cancelled ({cancelledBlocks.length})
          </h3>
          <div className="grid gap-3">
            {cancelledBlocks.map((bt) => (
              <BlockedTimeCard
                key={bt._id}
                blockedTime={bt as BlockedTimeListItem}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Calendar Event Component ─────────────────────────────────────────────────

export type BlockedTimeCalendarEvent = {
  _id: Id<"blockedTimes">;
  scope: BlockedTimeScope;
  start: string;
  end: string;
  reason: string;
  roomName?: string;
  roomTypeName?: string;
  campusName?: string;
};

export function BlockedTimeCalendarChip({
  blockedTime,
  onClick,
}: {
  blockedTime: BlockedTimeCalendarEvent;
  onClick?: () => void;
}) {
  const config = scopeConfig[blockedTime.scope];
  const Icon = config.icon;

  const targetName =
    blockedTime.roomName ??
    blockedTime.roomTypeName ??
    blockedTime.campusName ??
    "All rooms";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-1.5 rounded border-l-2 border-destructive bg-destructive/10 px-2 py-1 text-left text-xs transition-colors hover:bg-destructive/20",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      <Ban className="size-3 text-destructive" />
      <span className="truncate font-medium text-destructive">
        {blockedTime.reason}
      </span>
      <span className="ml-auto flex items-center gap-1 text-destructive/70">
        <Icon className="size-3" />
        <span className="hidden truncate sm:inline">{targetName}</span>
      </span>
    </button>
  );
}
