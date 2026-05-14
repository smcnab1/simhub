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
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
  MapPinIcon,
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  BuildingIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Campus = {
  _id: Id<"campuses">;
  name: string;
  active?: boolean;
  sortOrder?: number;
};

function EmptyCampuses({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted">
        <BuildingIcon className="size-6 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-medium text-foreground">No campuses yet</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          Add your first campus or site. Campuses help you organise rooms and
          manage bookings across multiple locations.
        </p>
      </div>
      <Button onClick={onAdd} size="sm" className="gap-1.5">
        <PlusIcon className="size-3.5" data-icon="inline-start" />
        Add campus
      </Button>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-12 ml-auto" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-7 w-7 rounded-md" />
        </div>
      ))}
    </div>
  );
}

interface CampusFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Campus | null;
  onSave: (data: {
    name: string;
    active: boolean;
    sortOrder?: number;
  }) => Promise<void>;
}

function CampusFormDialog({
  open,
  onOpenChange,
  editing,
  onSave,
}: CampusFormDialogProps) {
  const [name, setName] = useState(editing?.name ?? "");
  const [active, setActive] = useState(editing?.active ?? true);
  const [sortOrder, setSortOrder] = useState(
    editing?.sortOrder != null ? String(editing.sortOrder) : ""
  );
  const [saving, setSaving] = useState(false);

  // Reset when editing changes
  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
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
        name: name.trim(),
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit campus" : "Add campus"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update this campus's details."
              : "Add a new campus or site to your facility."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="campus-name">Campus name</Label>
            <Input
              id="campus-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Paragon House, City Campus"
              required
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="campus-sort">Sort order</Label>
            <Input
              id="campus-sort"
              type="number"
              min={0}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              placeholder="0"
              className="w-28"
            />
            <p className="text-xs text-muted-foreground">
              Lower numbers appear first in lists. Leave blank for alphabetical.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="campus-active" className="text-sm font-medium">
                Active
              </Label>
              <p className="text-xs text-muted-foreground">
                Inactive campuses are hidden from booking forms.
              </p>
            </div>
            <Switch
              id="campus-active"
              checked={active}
              onCheckedChange={setActive}
            />
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
              {saving ? "Saving…" : editing ? "Save changes" : "Add campus"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CampusesAdmin() {
  const auth = useDashboardAuth();
  const tenantSlug = auth.tenantSlug;
  const campuses = useQuery(api.tenants.listPrivateCampuses, {
    tenantSlug,
    auth,
    activeOnly: false,
  });
  const upsertCampus = useMutation(api.tenants.upsertCampus);
  const deleteCampus = useMutation(api.tenants.deleteCampus);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCampus, setEditingCampus] = useState<Campus | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Campus | null>(null);

  function handleAddNew() {
    setEditingCampus(null);
    setDialogOpen(true);
  }

  function handleEdit(campus: Campus) {
    setEditingCampus(campus);
    setDialogOpen(true);
  }

  async function handleSave(data: {
    name: string;
    active: boolean;
    sortOrder?: number;
  }) {
    try {
      await upsertCampus({
        tenantSlug,
        auth,
        campusId: editingCampus?._id ?? undefined,
        ...data,
      });
      toast.success(
        editingCampus ? "Campus updated." : "Campus added successfully."
      );
    } catch (err) {
      toast.error("Failed to save campus. Please try again.");
      throw err;
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteCampus({ tenantSlug, auth, campusId: deleteTarget._id });
      toast.success("Campus removed.");
    } catch {
      toast.error("Failed to remove campus.");
    } finally {
      setDeleteTarget(null);
    }
  }

  const isLoading = campuses === undefined;

  return (
    <div className="flex flex-col gap-8 pb-16">
      <AdminPageHeader
        title="Campuses"
        description="Manage the physical sites and campuses that make up your facility."
        breadcrumbs={[{ label: "Campuses" }]}
        actions={
          <Button onClick={handleAddNew} size="sm" className="gap-1.5">
            <PlusIcon className="size-3.5" data-icon="inline-start" />
            Add campus
          </Button>
        }
      />

      <AdminSettingsCard
        title="Campus / Site List"
        description="All campuses associated with this tenant. Inactive campuses are hidden from public booking forms."
        icon={<MapPinIcon className="size-4" />}
        noPadding
      >
        {isLoading ? (
          <div className="p-4">
            <TableSkeleton />
          </div>
        ) : campuses.length === 0 ? (
          <EmptyCampuses onAdd={handleAddNew} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Campus name</TableHead>
                  <TableHead>Sort order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campuses.map((campus) => (
                  <TableRow key={campus._id}>
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-2">
                        <StatusDot active={campus.active !== false} />
                        <span className="font-medium text-foreground">
                          {campus.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {campus.sortOrder ?? <span className="text-border">—</span>}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={campus.active === false ? "Inactive" : "Active"}
                      />
                    </TableCell>
                    <TableCell className="pr-6">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => handleEdit(campus)}
                          aria-label={`Edit ${campus.name}`}
                        >
                          <PencilIcon className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteTarget(campus)}
                          aria-label={`Delete ${campus.name}`}
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

      <CampusFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editingCampus}
        onSave={handleSave}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete campus?</AlertDialogTitle>
            <AlertDialogDescription>
              {`Are you sure you want to delete "${deleteTarget?.name}"? If this campus has associated rooms or room types, it will be deactivated instead of permanently deleted.`}
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
