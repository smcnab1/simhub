"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useDashboardAuth } from "@/components/dashboard-auth";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSettingsCard } from "@/components/admin/admin-settings-card";
import { StatusBadge, StatusDot } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  LayoutGridIcon,
  PlusIcon,
  PencilIcon,
  ArchiveIcon,
  UsersIcon,
  ClockIcon,
  SearchIcon,
  SparklesIcon,
} from "lucide-react";
import { toast } from "sonner";
import { formatBookingDuration } from "@/lib/booking-logic";

type RoomTypeWithCounts = {
  _id: Id<"roomTypes">;
  name: string;
  description?: string;
  defaultCapacity: number;
  maxBookingDurationMinutes?: number;
  standardSetupMinutes?: number;
  standardCleanupMinutes?: number;
  specialRoom: boolean;
  active: boolean;
  sortOrder?: number;
  campusId?: Id<"campuses">;
  roomCount: number;
  activeRoomCount: number;
  campus: { _id: Id<"campuses">; name: string } | null;
};

function TableSkeleton() {
  return (
    <div className="flex flex-col divide-y divide-border">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-4">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-24 ml-4" />
          <Skeleton className="h-4 w-16 ml-auto" />
          <Skeleton className="h-6 w-14" />
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-7 w-7 rounded-md" />
        </div>
      ))}
    </div>
  );
}

function EmptyRoomTypes({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted">
        <LayoutGridIcon className="size-6 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-medium text-foreground">No room types yet</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          Room types categorise your spaces. Examples: Classroom, Ward,
          Simulation Suite, Consultation Room, VR Lab.
        </p>
      </div>
      <Button onClick={onAdd} size="sm" className="gap-1.5">
        <PlusIcon className="size-3.5" data-icon="inline-start" />
        Add room type
      </Button>
    </div>
  );
}

interface RoomTypeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: RoomTypeWithCounts | null;
  campuses: { _id: Id<"campuses">; name: string }[];
  onSave: (data: {
    campusId?: Id<"campuses">;
    name: string;
    description?: string;
    defaultCapacity: number;
    maxBookingDurationMinutes?: number;
    standardSetupMinutes?: number;
    standardCleanupMinutes?: number;
    specialRoom: boolean;
    active: boolean;
    sortOrder?: number;
  }) => Promise<void>;
}

function RoomTypeFormDialog({
  open,
  onOpenChange,
  editing,
  campuses,
  onSave,
}: RoomTypeFormDialogProps) {
  const [campusId, setCampusId] = useState<string>(editing?.campusId ?? "");
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [defaultCapacity, setDefaultCapacity] = useState(
    String(editing?.defaultCapacity ?? 1)
  );
  const [maxDurationHours, setMaxDurationHours] = useState(
    editing?.maxBookingDurationMinutes != null
      ? String(Math.floor(editing.maxBookingDurationMinutes / 60))
      : ""
  );
  const [maxDurationMinutes, setMaxDurationMinutes] = useState(
    editing?.maxBookingDurationMinutes != null
      ? String(editing.maxBookingDurationMinutes % 60)
      : ""
  );
  const [standardSetupMinutes, setStandardSetupMinutes] = useState(
    String(editing?.standardSetupMinutes ?? 30)
  );
  const [standardCleanupMinutes, setStandardCleanupMinutes] = useState(
    String(editing?.standardCleanupMinutes ?? 30)
  );
  const [specialRoom, setSpecialRoom] = useState(editing?.specialRoom ?? false);
  const [active, setActive] = useState(editing?.active ?? true);
  const [sortOrder, setSortOrder] = useState(
    editing?.sortOrder != null ? String(editing.sortOrder) : ""
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const selectedCampus = campuses.find((campus) => campus._id === campusId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedCapacity = Number(defaultCapacity);
    const hasMaxDuration =
      maxDurationHours.trim() !== "" || maxDurationMinutes.trim() !== "";
    const parsedMaxDurationHours = maxDurationHours
      ? Number(maxDurationHours)
      : 0;
    const parsedMaxDurationMinutes = maxDurationMinutes
      ? Number(maxDurationMinutes)
      : 0;
    const parsedMaxDuration = hasMaxDuration
      ? parsedMaxDurationHours * 60 + parsedMaxDurationMinutes
      : undefined;
    const parsedSortOrder = sortOrder ? Number(sortOrder) : undefined;
    const parsedStandardSetupMinutes = Number(standardSetupMinutes);
    const parsedStandardCleanupMinutes = Number(standardCleanupMinutes);

    if (!name.trim()) {
      setFormError("Room type name is required.");
      return;
    }

    if (!Number.isInteger(parsedCapacity) || parsedCapacity < 0) {
      setFormError("Default capacity must be a whole number greater than or equal to zero.");
      return;
    }

    if (
      hasMaxDuration &&
      (!Number.isInteger(parsedMaxDurationHours) ||
        parsedMaxDurationHours < 0 ||
        !Number.isInteger(parsedMaxDurationMinutes) ||
        parsedMaxDurationMinutes < 0 ||
        parsedMaxDurationMinutes > 59 ||
        parsedMaxDuration === undefined ||
        parsedMaxDuration <= 0)
    ) {
      setFormError("Maximum booking duration must be whole hours and minutes greater than zero.");
      return;
    }

    if (parsedSortOrder !== undefined && !Number.isInteger(parsedSortOrder)) {
      setFormError("Sort order must be a whole number.");
      return;
    }

    if (
      !Number.isInteger(parsedStandardSetupMinutes) ||
      parsedStandardSetupMinutes < 0 ||
      !Number.isInteger(parsedStandardCleanupMinutes) ||
      parsedStandardCleanupMinutes < 0
    ) {
      setFormError("Standard setup and cleanup must be whole minutes greater than or equal to zero.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await onSave({
        campusId: campusId ? (campusId as Id<"campuses">) : undefined,
        name: name.trim(),
        description: description.trim() || undefined,
        defaultCapacity: parsedCapacity,
        maxBookingDurationMinutes: parsedMaxDuration,
        standardSetupMinutes: parsedStandardSetupMinutes,
        standardCleanupMinutes: parsedStandardCleanupMinutes,
        specialRoom,
        active,
        sortOrder: parsedSortOrder,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit room type" : "Add room type"}
          </DialogTitle>
          <DialogDescription>
            Room types categorise physical spaces and set default booking rules.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rt-campus">Campus (optional)</Label>
            <Select value={campusId} onValueChange={(v) => setCampusId(v ?? "")}>
              <SelectTrigger id="rt-campus">
                <SelectValue>
                  {selectedCampus?.name ?? "All campuses"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="" label="All campuses">
                  All campuses
                </SelectItem>
                {campuses.map((c) => (
                  <SelectItem key={c._id} value={c._id} label={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rt-name">Name</Label>
            <Input
              id="rt-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Simulation Ward, Classroom, VR Suite"
              required
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rt-desc">Description (optional)</Label>
            <Textarea
              id="rt-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this room type, typical layout, use cases…"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_2fr_1fr]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rt-capacity">Default capacity</Label>
              <Input
                id="rt-capacity"
                type="number"
                min={0}
                value={defaultCapacity}
                onChange={(e) => setDefaultCapacity(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rt-duration-hours">Max duration</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1.5 rounded-lg border border-input px-2.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                  <Input
                    id="rt-duration-hours"
                    type="number"
                    min={0}
                    value={maxDurationHours}
                    onChange={(e) => setMaxDurationHours(e.target.value)}
                    placeholder="0"
                    className="h-7 border-0 px-0 shadow-none focus-visible:ring-0"
                  />
                  <span className="text-xs text-muted-foreground">hr</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg border border-input px-2.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                  <Input
                    id="rt-duration-minutes"
                    type="number"
                    min={0}
                    max={59}
                    value={maxDurationMinutes}
                    onChange={(e) => setMaxDurationMinutes(e.target.value)}
                    placeholder="0"
                    className="h-7 border-0 px-0 shadow-none focus-visible:ring-0"
                  />
                  <span className="text-xs text-muted-foreground">min</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rt-sort">Sort order</Label>
              <Input
                id="rt-sort"
                type="number"
                min={0}
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                placeholder="Auto"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rt-setup">Standard setup</Label>
              <div className="flex items-center gap-1.5 rounded-lg border border-input px-2.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                <Input
                  id="rt-setup"
                  type="number"
                  min={0}
                  value={standardSetupMinutes}
                  onChange={(e) => setStandardSetupMinutes(e.target.value)}
                  className="h-7 border-0 px-0 shadow-none focus-visible:ring-0"
                />
                <span className="text-xs text-muted-foreground">min</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rt-cleanup">Standard cleanup</Label>
              <div className="flex items-center gap-1.5 rounded-lg border border-input px-2.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                <Input
                  id="rt-cleanup"
                  type="number"
                  min={0}
                  value={standardCleanupMinutes}
                  onChange={(e) => setStandardCleanupMinutes(e.target.value)}
                  className="h-7 border-0 px-0 shadow-none focus-visible:ring-0"
                />
                <span className="text-xs text-muted-foreground">min</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex flex-col gap-0.5">
                <Label className="text-sm font-medium">Specialist space</Label>
                <p className="text-xs text-muted-foreground">
                  Flags this as a specialist/non-standard room requiring extra admin review.
                </p>
              </div>
              <Switch checked={specialRoom} onCheckedChange={setSpecialRoom} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex flex-col gap-0.5">
                <Label className="text-sm font-medium">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive types are hidden from booking forms.
                </p>
              </div>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
          </div>

          {formError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </p>
          ) : null}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving
                ? "Saving…"
                : editing
                ? "Save changes"
                : "Add room type"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RoomTypesAdmin() {
  const auth = useDashboardAuth();
  const tenantSlug = auth.tenantSlug;

  const campuses = useQuery(api.tenants.listPrivateCampuses, {
    tenantSlug,
    auth,
    activeOnly: false,
  });
  const roomTypes = useQuery(api.tenants.listAdminRoomTypes, {
    tenantSlug,
    auth,
    activeOnly: false,
  });
  const upsertRoomType = useMutation(api.tenants.upsertRoomType);
  const deleteRoomType = useMutation(api.tenants.deleteRoomType);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<RoomTypeWithCounts | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoomTypeWithCounts | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("all");
  const [sortBy, setSortBy] = useState<"sortOrder" | "name" | "activeRooms">("sortOrder");

  const filteredRoomTypes = useMemo(() => {
    if (!roomTypes) return [];

    const q = search.trim().toLowerCase();

    return [...roomTypes]
      .filter((rt) => {
        const matchesSearch =
          !q ||
          rt.name.toLowerCase().includes(q) ||
          rt.description?.toLowerCase().includes(q) ||
          rt.campus?.name.toLowerCase().includes(q);
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "active" ? rt.active : !rt.active);

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "activeRooms") return b.activeRoomCount - a.activeRoomCount;

        const aOrder = a.sortOrder ?? 9999;
        const bOrder = b.sortOrder ?? 9999;

        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.name.localeCompare(b.name);
      });
  }, [roomTypes, search, statusFilter, sortBy]);

  function handleAddNew() {
    setEditingType(null);
    setDialogOpen(true);
  }

  async function handleSave(data: Parameters<RoomTypeFormDialogProps["onSave"]>[0]) {
    try {
      await upsertRoomType({
        tenantSlug,
        auth,
        roomTypeId: editingType?._id ?? undefined,
        ...data,
      });
      toast.success(editingType ? "Room type updated." : "Room type added.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save room type.";
      toast.error(msg);
      throw err;
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteRoomType({
        tenantSlug,
        auth,
        roomTypeId: deleteTarget._id,
      });
      toast.success("Room type archived.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to archive room type.";
      toast.error(msg);
    } finally {
      setDeleteTarget(null);
    }
  }

  const isLoading = roomTypes === undefined || campuses === undefined;

  return (
    <div className="flex flex-col gap-8 pb-16">
      <AdminPageHeader
        title="Room Types"
        description="Define categories of spaces available for booking. Room types set defaults for capacity and booking duration."
        breadcrumbs={[{ label: "Room Types" }]}
        actions={
          <Button onClick={handleAddNew} size="sm" className="gap-1.5">
            <PlusIcon className="size-3.5" data-icon="inline-start" />
            Add room type
          </Button>
        }
      />

      <AdminSettingsCard
        title="Room Types"
        description="Each room type groups similar spaces and provides default configuration for rooms assigned to it."
        icon={<LayoutGridIcon className="size-4" />}
        noPadding
      >
        {isLoading ? (
          <div className="py-2">
            <TableSkeleton />
          </div>
        ) : roomTypes.length === 0 ? (
          <EmptyRoomTypes onAdd={handleAddNew} />
        ) : (
          <div>
            <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
              <div className="relative min-w-52 flex-1">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search room types..."
                  className="h-8 pl-8 text-sm"
                  aria-label="Search room types"
                />
              </div>

              <Select value={statusFilter} onValueChange={(v) => setStatusFilter((v as typeof statusFilter) ?? "all")}>
                <SelectTrigger className="h-8 w-40 text-sm">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(v) => setSortBy((v as typeof sortBy) ?? "sortOrder")}>
                <SelectTrigger className="h-8 w-44 text-sm">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sortOrder">Sort order</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="activeRooms">Active rooms</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {filteredRoomTypes.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-medium text-foreground">No room types match your filters.</p>
                <p className="mt-1 text-xs text-muted-foreground">Try a different search term or status.</p>
              </div>
            ) : (
              <>
              <div className="grid gap-3 p-3 md:hidden">
                {filteredRoomTypes.map((rt) => (
                  <article key={rt._id} className="rounded-xl border border-border bg-card p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusDot active={rt.active} />
                          <h3 className="break-words text-sm font-semibold text-foreground">{rt.name}</h3>
                          {rt.specialRoom && (
                            <Badge variant="outline" className="bg-primary/10 py-0 text-[10px] text-primary">
                              <SparklesIcon className="size-2.5" />
                              Special
                            </Badge>
                          )}
                        </div>
                        {rt.description ? (
                          <p className="mt-1 break-words text-xs text-muted-foreground">{rt.description}</p>
                        ) : null}
                      </div>
                      <StatusBadge status={rt.active ? "Active" : "Inactive"} />
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-muted/40 p-2">
                        <dt className="text-muted-foreground">Campus</dt>
                        <dd className="mt-0.5 font-medium text-foreground">{rt.campus?.name ?? "All campuses"}</dd>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-2">
                        <dt className="text-muted-foreground">Rooms</dt>
                        <dd className="mt-0.5 font-medium text-foreground">{rt.activeRoomCount}/{rt.roomCount}</dd>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-2">
                        <dt className="text-muted-foreground">Capacity</dt>
                        <dd className="mt-0.5 font-medium text-foreground">{rt.defaultCapacity}</dd>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-2">
                        <dt className="text-muted-foreground">Buffers</dt>
                        <dd className="mt-0.5 font-medium text-foreground">{rt.standardSetupMinutes ?? 30}+{rt.standardCleanupMinutes ?? 30} min</dd>
                      </div>
                    </dl>
                    <div className="sticky bottom-0 -mx-3 -mb-3 mt-3 flex justify-end gap-1.5 border-t border-border bg-card/95 p-3">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-9"
                        onClick={() => {
                          setEditingType(rt as unknown as RoomTypeWithCounts);
                          setDialogOpen(true);
                        }}
                        aria-label={`Edit ${rt.name}`}
                      >
                        <PencilIcon className="size-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() =>
                          setDeleteTarget(rt as unknown as RoomTypeWithCounts)
                        }
                        aria-label={`Archive ${rt.name}`}
                      >
                        <ArchiveIcon className="size-3.5" />
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Type</TableHead>
                  <TableHead>Campus</TableHead>
                  <TableHead>Rooms</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Max duration</TableHead>
                  <TableHead>Buffers</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoomTypes.map((rt) => (
                  <TableRow key={rt._id}>
                    <TableCell className="pl-6">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <StatusDot active={rt.active} />
                          <span className="font-medium text-foreground">
                            {rt.name}
                          </span>
                          {rt.specialRoom && (
                            <Badge variant="outline" className="text-[10px] py-0 bg-primary/10 text-primary border-border">
                              <SparklesIcon className="size-2.5" />
                              Special
                            </Badge>
                          )}
                        </div>
                        {rt.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-xs pl-4">
                            {rt.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {rt.campus?.name ?? (
                        <span className="text-border/70 italic">All campuses</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="tabular-nums text-sm">
                        <span className="text-foreground font-medium">
                          {rt.activeRoomCount}
                        </span>
                        <span className="text-muted-foreground">
                          /{rt.roomCount}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <UsersIcon className="size-3 text-muted-foreground/50" />
                        {rt.defaultCapacity}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {rt.maxBookingDurationMinutes ? (
                        <div className="flex items-center gap-1">
                          <ClockIcon className="size-3 text-muted-foreground/50" />
                          {formatBookingDuration(rt.maxBookingDurationMinutes)}
                        </div>
                      ) : (
                        <span className="text-border/70 italic">No limit</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <ClockIcon className="size-3 text-muted-foreground/50" />
                        {rt.standardSetupMinutes ?? 30}+{rt.standardCleanupMinutes ?? 30} min
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={rt.active ? "Active" : "Inactive"} />
                    </TableCell>
                    <TableCell className="pr-6">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => {
                            setEditingType(rt as unknown as RoomTypeWithCounts);
                            setDialogOpen(true);
                          }}
                          aria-label={`Edit ${rt.name}`}
                        >
                          <PencilIcon className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() =>
                            setDeleteTarget(rt as unknown as RoomTypeWithCounts)
                          }
                          aria-label={`Archive ${rt.name}`}
                        >
                          <ArchiveIcon className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
              </div>
              </>
            )}
          </div>
        )}
      </AdminSettingsCard>

      {dialogOpen ? (
        <RoomTypeFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          editing={editingType}
          campuses={(campuses ?? []) as { _id: Id<"campuses">; name: string }[]}
          onSave={handleSave}
        />
      ) : null}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive room type?</AlertDialogTitle>
            <AlertDialogDescription>
              {`Archive "${deleteTarget?.name}"? It will be hidden from new room and booking choices, while existing rooms and historic bookings continue to function.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
