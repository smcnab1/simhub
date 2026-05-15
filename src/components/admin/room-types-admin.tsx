"use client";

import { useState, useEffect } from "react";
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
  Trash2Icon,
  UsersIcon,
  ClockIcon,
  StarIcon,
} from "lucide-react";
import { toast } from "sonner";

type RoomTypeWithCounts = {
  _id: Id<"roomTypes">;
  name: string;
  description?: string;
  defaultCapacity: number;
  maxDurationHours?: number;
  isSpecial: boolean;
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
    maxDurationHours?: number;
    isSpecial: boolean;
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
  const [maxDuration, setMaxDuration] = useState(
    editing?.maxDurationHours != null ? String(editing.maxDurationHours) : ""
  );
  const [isSpecial, setIsSpecial] = useState(editing?.isSpecial ?? false);
  const [active, setActive] = useState(editing?.active ?? true);
  const [sortOrder, setSortOrder] = useState(
    editing?.sortOrder != null ? String(editing.sortOrder) : ""
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCampusId(editing?.campusId ?? "");
      setName(editing?.name ?? "");
      setDescription(editing?.description ?? "");
      setDefaultCapacity(String(editing?.defaultCapacity ?? 1));
      setMaxDuration(
        editing?.maxDurationHours != null ? String(editing.maxDurationHours) : ""
      );
      setIsSpecial(editing?.isSpecial ?? false);
      setActive(editing?.active ?? true);
      setSortOrder(editing?.sortOrder != null ? String(editing.sortOrder) : "");
    }
  }, [open, editing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        campusId: campusId ? (campusId as Id<"campuses">) : undefined,
        name: name.trim(),
        description: description.trim() || undefined,
        defaultCapacity: Number(defaultCapacity) || 1,
        maxDurationHours: maxDuration ? Number(maxDuration) : undefined,
        isSpecial,
        active,
        sortOrder: sortOrder ? Number(sortOrder) : undefined,
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
                <SelectValue placeholder="All campuses / no specific campus" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All campuses</SelectItem>
                {campuses.map((c) => (
                  <SelectItem key={c._id} value={c._id}>
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

          <div className="grid grid-cols-3 gap-3">
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
              <Label htmlFor="rt-duration">Max hours</Label>
              <Input
                id="rt-duration"
                type="number"
                min={1}
                value={maxDuration}
                onChange={(e) => setMaxDuration(e.target.value)}
                placeholder="No limit"
              />
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

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex flex-col gap-0.5">
                <Label className="text-sm font-medium">Specialist space</Label>
                <p className="text-xs text-muted-foreground">
                  Flags this as a specialist/non-standard room requiring extra admin review.
                </p>
              </div>
              <Switch checked={isSpecial} onCheckedChange={setIsSpecial} />
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
  const roomTypes = useQuery(api.tenants.listPrivateRoomTypes, {
    tenantSlug,
    auth,
    activeOnly: false,
  });
  const upsertRoomType = useMutation(api.tenants.upsertRoomType);
  const deleteRoomType = useMutation(api.tenants.deleteRoomType);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<RoomTypeWithCounts | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoomTypeWithCounts | null>(null);

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
    } catch {
      toast.error("Failed to save room type.");
      throw new Error("save failed");
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
      toast.success("Room type removed.");
    } catch {
      toast.error("Failed to remove room type.");
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Type</TableHead>
                  <TableHead>Campus</TableHead>
                  <TableHead>Rooms</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Max duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roomTypes.map((rt) => (
                  <TableRow key={rt._id}>
                    <TableCell className="pl-6">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <StatusDot active={rt.active} />
                          <span className="font-medium text-foreground">
                            {rt.name}
                          </span>
                          {rt.isSpecial && (
                            <Badge variant="outline" className="text-[10px] py-0 bg-primary/10 text-primary border-border">
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
                      {rt.maxDurationHours ? (
                        <div className="flex items-center gap-1">
                          <ClockIcon className="size-3 text-muted-foreground/50" />
                          {rt.maxDurationHours}h
                        </div>
                      ) : (
                        <span className="text-border/70 italic">No limit</span>
                      )}
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
                          aria-label={`Delete ${rt.name}`}
                        >
                          <Trash2Icon className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </AdminSettingsCard>

      <RoomTypeFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editingType}
        campuses={(campuses ?? []) as { _id: Id<"campuses">; name: string }[]}
        onSave={handleSave}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete room type?</AlertDialogTitle>
            <AlertDialogDescription>
              {`Delete "${deleteTarget?.name}"? If rooms are linked to this type it will be deactivated instead of permanently removed.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
