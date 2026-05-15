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
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
  ArchiveIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  BuildingIcon,
  MapPinIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  normalizeCampusName,
  normalizeCampusText,
  validateCampusSortOrder,
} from "@/lib/campus";

type Campus = {
  _id: Id<"campuses">;
  name: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  details?: string;
  active?: boolean;
  sortOrder?: number;
};

type StatusFilter = "all" | "active" | "inactive";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function campusLocationSummary(campus: Campus) {
  return [
    campus.addressLine1,
    campus.addressLine2,
    campus.city,
    campus.region,
    campus.postalCode,
    campus.country,
  ]
    .filter(Boolean)
    .join(", ");
}

function EmptyCampuses({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted">
        <BuildingIcon className="size-6 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-medium text-foreground">No campuses yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Add your first campus or site. Campuses help organise rooms and
          bookings across multiple locations.
        </p>
      </div>
      <Button onClick={onAdd} size="sm" className="gap-1.5">
        <PlusIcon className="size-3.5" data-icon="inline-start" />
        Add campus
      </Button>
    </div>
  );
}

function NoResults({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <p className="text-sm font-medium text-foreground">
        No campuses match &ldquo;{query}&rdquo;
      </p>
      <p className="text-xs text-muted-foreground">
        Adjust the search or status filter.
      </p>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="flex flex-col divide-y divide-border">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-16 ml-auto" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-7 w-20 rounded-md" />
          <Skeleton className="h-7 w-16 rounded-md" />
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
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
    details?: string;
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
  const [addressLine1, setAddressLine1] = useState(
    editing?.addressLine1 ?? ""
  );
  const [addressLine2, setAddressLine2] = useState(
    editing?.addressLine2 ?? ""
  );
  const [city, setCity] = useState(editing?.city ?? "");
  const [region, setRegion] = useState(editing?.region ?? "");
  const [postalCode, setPostalCode] = useState(editing?.postalCode ?? "");
  const [country, setCountry] = useState(editing?.country ?? "");
  const [details, setDetails] = useState(editing?.details ?? "");
  const [active, setActive] = useState(editing?.active ?? true);
  const [sortOrder, setSortOrder] = useState(
    editing?.sortOrder != null ? String(editing.sortOrder) : ""
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const normalizedName = normalizeCampusName(name);
    const parsedSortOrder = sortOrder ? Number(sortOrder) : undefined;
    const sortOrderError = validateCampusSortOrder(parsedSortOrder);

    if (!normalizedName) {
      setFormError("Campus name is required.");
      return;
    }

    if (sortOrderError) {
      setFormError(sortOrderError);
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await onSave({
        name: normalizedName,
        addressLine1: normalizeCampusText(addressLine1),
        addressLine2: normalizeCampusText(addressLine2),
        city: normalizeCampusText(city),
        region: normalizeCampusText(region),
        postalCode: normalizeCampusText(postalCode),
        country: normalizeCampusText(country),
        details: normalizeCampusText(details),
        active,
        sortOrder: parsedSortOrder,
      });
      onOpenChange(false);
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit campus" : "Add campus"}</DialogTitle>
          <DialogDescription>
            Campuses can be archived without breaking historic bookings or
            admin reports.
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

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="campus-address-1">Address line 1</Label>
              <Input
                id="campus-address-1"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="Building and street"
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="campus-address-2">Address line 2</Label>
              <Input
                id="campus-address-2"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                placeholder="Floor, suite, area, or department"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="campus-city">Town / city</Label>
              <Input
                id="campus-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. London"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="campus-region">County / region</Label>
              <Input
                id="campus-region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="e.g. Greater London"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="campus-postal-code">Postcode</Label>
              <Input
                id="campus-postal-code"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="e.g. W5 5RF"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="campus-country">Country</Label>
              <Input
                id="campus-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. United Kingdom"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="campus-details">Location details</Label>
            <Textarea
              id="campus-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Reception notes, access instructions, parking, nearby entrance, or future location metadata."
              rows={3}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="campus-sort">Sort order</Label>
            <Input
              id="campus-sort"
              type="number"
              min={0}
              step={1}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              placeholder="Auto"
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">
              Lower numbers appear first. Blank campuses sort after numbered
              campuses by name.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="campus-active" className="text-sm font-medium">
                Active
              </Label>
              <p className="text-xs text-muted-foreground">
                Inactive campuses stay in admin and history, but are hidden
                from requester booking flows.
              </p>
            </div>
            <Switch
              id="campus-active"
              checked={active}
              onCheckedChange={setActive}
            />
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
              {saving ? "Saving..." : editing ? "Save changes" : "Add campus"}
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
  const campuses = useQuery(api.tenants.listAdminCampuses, {
    tenantSlug,
    auth,
    activeOnly: false,
  });
  const upsertCampus = useMutation(api.tenants.upsertCampus);
  const archiveCampus = useMutation(api.tenants.deleteCampus);
  const reorderCampuses = useMutation(api.tenants.reorderCampuses);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCampus, setEditingCampus] = useState<Campus | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Campus | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [reordering, setReordering] = useState(false);

  const orderedCampuses = useMemo(() => campuses ?? [], [campuses]);
  const filteredCampuses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return orderedCampuses.filter((campus) => {
      const isActive = campus.active !== false;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && isActive) ||
        (statusFilter === "inactive" && !isActive);
      const matchesQuery =
        !normalizedQuery ||
        campus.name.toLowerCase().includes(normalizedQuery) ||
        campusLocationSummary(campus).toLowerCase().includes(normalizedQuery) ||
        campus.details?.toLowerCase().includes(normalizedQuery) ||
        String(campus.sortOrder ?? "").includes(normalizedQuery);

      return matchesStatus && matchesQuery;
    });
  }, [orderedCampuses, query, statusFilter]);

  const activeCount = orderedCampuses.filter(
    (campus) => campus.active !== false
  ).length;
  const inactiveCount = orderedCampuses.length - activeCount;

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
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
    details?: string;
    active: boolean;
    sortOrder?: number;
  }) {
    await upsertCampus({
      tenantSlug,
      auth,
      campusId: editingCampus?._id ?? undefined,
      ...data,
    });
    toast.success(editingCampus ? "Campus updated." : "Campus added.");
  }

  async function handleArchive() {
    if (!archiveTarget) {
      return;
    }

    try {
      await archiveCampus({ tenantSlug, auth, campusId: archiveTarget._id });
      toast.success("Campus archived.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setArchiveTarget(null);
    }
  }

  async function handleRestore(campus: Campus) {
    try {
      await upsertCampus({
        tenantSlug,
        auth,
        campusId: campus._id,
        name: campus.name,
        addressLine1: campus.addressLine1,
        addressLine2: campus.addressLine2,
        city: campus.city,
        region: campus.region,
        postalCode: campus.postalCode,
        country: campus.country,
        details: campus.details,
        active: true,
        sortOrder: campus.sortOrder,
      });
      toast.success("Campus restored.");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function moveCampus(campus: Campus, direction: -1 | 1) {
    const currentIndex = orderedCampuses.findIndex(
      (item) => item._id === campus._id
    );
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= orderedCampuses.length) {
      return;
    }

    const nextOrder = [...orderedCampuses];
    const [moved] = nextOrder.splice(currentIndex, 1);
    nextOrder.splice(nextIndex, 0, moved);

    setReordering(true);
    try {
      await reorderCampuses({
        tenantSlug,
        auth,
        campusIds: nextOrder.map((item) => item._id),
      });
      toast.success("Campus order updated.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setReordering(false);
    }
  }

  const isLoading = campuses === undefined;
  const hasFilters = query.trim() || statusFilter !== "all";

  return (
    <div className="flex flex-col gap-8 pb-16">
      <AdminPageHeader
        title="Campuses"
        description="Create, order, and archive the sites that make up this tenant."
        breadcrumbs={[{ label: "Campuses" }]}
        actions={
          <Button onClick={handleAddNew} size="sm" className="gap-1.5">
            <PlusIcon className="size-3.5" data-icon="inline-start" />
            Add campus
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <AdminSettingsCard title="Total" description="All admin-visible sites">
          <p className="text-2xl font-semibold text-foreground">
            {orderedCampuses.length}
          </p>
        </AdminSettingsCard>
        <AdminSettingsCard title="Active" description="Visible to requesters">
          <p className="text-2xl font-semibold text-foreground">
            {activeCount}
          </p>
        </AdminSettingsCard>
        <AdminSettingsCard title="Inactive" description="Retained for history">
          <p className="text-2xl font-semibold text-foreground">
            {inactiveCount}
          </p>
        </AdminSettingsCard>
      </div>

      <AdminSettingsCard
        title="Campus / Site List"
        description="Inactive campuses remain linked to historic rooms, bookings, calendars, and reports."
        icon={<MapPinIcon className="size-4" />}
        noPadding
      >
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search campuses..."
              className="pl-9"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <TableSkeleton />
        ) : orderedCampuses.length === 0 ? (
          <EmptyCampuses onAdd={handleAddNew} />
        ) : filteredCampuses.length === 0 && hasFilters ? (
          <NoResults query={query.trim() || statusFilter} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Campus name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Sort</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead className="pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCampuses.map((campus) => {
                  const isActive = campus.active !== false;
                  const orderIndex = orderedCampuses.findIndex(
                    (item) => item._id === campus._id
                  );

                  return (
                    <TableRow key={campus._id} className={!isActive ? "opacity-70" : ""}>
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-2">
                          <StatusDot active={isActive} />
                          <span className="font-medium text-foreground">
                            {campus.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs text-sm text-muted-foreground">
                        {campusLocationSummary(campus) || (
                          <span className="text-border/70 italic">
                            No address
                          </span>
                        )}
                        {campus.details ? (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground/80">
                            {campus.details}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {campus.sortOrder ?? (
                          <span className="font-sans text-border">Auto</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={isActive ? "Active" : "Inactive"} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => moveCampus(campus, -1)}
                            disabled={reordering || orderIndex <= 0}
                            aria-label={`Move ${campus.name} up`}
                          >
                            <ArrowUpIcon className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => moveCampus(campus, 1)}
                            disabled={
                              reordering ||
                              orderIndex < 0 ||
                              orderIndex >= orderedCampuses.length - 1
                            }
                            aria-label={`Move ${campus.name} down`}
                          >
                            <ArrowDownIcon className="size-3.5" />
                          </Button>
                        </div>
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
                          {isActive ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setArchiveTarget(campus)}
                              aria-label={`Archive ${campus.name}`}
                            >
                              <ArchiveIcon className="size-3.5" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() => handleRestore(campus)}
                              aria-label={`Restore ${campus.name}`}
                            >
                              <RotateCcwIcon className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </AdminSettingsCard>

      {dialogOpen ? (
        <CampusFormDialog
          key={editingCampus?._id ?? "new-campus"}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          editing={editingCampus}
          onSave={handleSave}
        />
      ) : null}

      <AlertDialog
        open={!!archiveTarget}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive campus?</AlertDialogTitle>
            <AlertDialogDescription>
              {`"${archiveTarget?.name}" will be hidden from requester booking forms, while existing rooms, bookings, and history keep their campus link.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
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
