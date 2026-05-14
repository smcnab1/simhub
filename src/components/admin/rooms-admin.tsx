"use client";

import { useState, useMemo } from "react";
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
import { Separator } from "@/components/ui/separator";
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
  DoorOpenIcon,
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  UsersIcon,
  SearchIcon,
  FilterIcon,
  LayoutGridIcon,
  ListIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Room = {
  _id: Id<"rooms">;
  code: string;
  name: string;
  description?: string;
  capacity: number;
  active: boolean;
  campusId?: Id<"campuses">;
  roomTypeId: Id<"roomTypes">;
  roomType: { _id: Id<"roomTypes">; name: string } | null;
  campus: { _id: Id<"campuses">; name: string } | null;
};

function TableSkeleton() {
  return (
    <div className="flex flex-col divide-y divide-border">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-24 ml-auto" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-6 w-14" />
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-7 w-7 rounded-md" />
        </div>
      ))}
    </div>
  );
}

function EmptyRooms({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted">
        <DoorOpenIcon className="size-6 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-medium text-foreground">No rooms yet</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          Add individual bookable rooms. Each room needs a unique code, a room type, and a
          capacity. You must create room types first.
        </p>
      </div>
      <Button onClick={onAdd} size="sm" className="gap-1.5">
        <PlusIcon className="size-3.5" data-icon="inline-start" />
        Add room
      </Button>
    </div>
  );
}

function NoResults({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <p className="text-sm font-medium text-foreground">No rooms match &ldquo;{query}&rdquo;</p>
      <p className="text-xs text-muted-foreground">Try a different search term.</p>
    </div>
  );
}

interface RoomCardProps {
  room: Room;
  onEdit: (room: Room) => void;
  onDelete: (room: Room) => void;
}

function RoomCard({ room, onEdit, onDelete }: RoomCardProps) {
  return (
    <div className={cn(
      "flex flex-col gap-3 rounded-xl border border-border p-4 bg-card shadow-sm",
      !room.active && "opacity-60"
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {room.code}
            </span>
            <StatusDot active={room.active} />
          </div>
          <p className="mt-1 font-medium text-foreground">{room.name}</p>
        </div>
        <StatusBadge status={room.active ? "Active" : "Inactive"} />
      </div>

      {room.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{room.description}</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {room.roomType && (
          <Badge variant="outline" className="text-[10px]">
            {room.roomType.name}
          </Badge>
        )}
        {room.campus && (
          <Badge variant="outline" className="text-[10px]">
            {room.campus.name}
          </Badge>
        )}
        <Badge variant="outline" className="text-[10px] gap-0.5">
          <UsersIcon className="size-2.5" />
          {room.capacity}
        </Badge>
      </div>

      <Separator />

      <div className="flex items-center justify-end gap-1.5">
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => onEdit(room)}>
          <PencilIcon className="size-3" />
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => onDelete(room)}
        >
          <Trash2Icon className="size-3" />
          Delete
        </Button>
      </div>
    </div>
  );
}

interface RoomFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Room | null;
  campuses: { _id: Id<"campuses">; name: string; active?: boolean }[];
  roomTypes: { _id: Id<"roomTypes">; name: string; active: boolean; campus: { name: string } | null }[];
  onSave: (data: {
    campusId?: Id<"campuses">;
    roomTypeId: Id<"roomTypes">;
    code: string;
    name: string;
    description?: string;
    capacity: number;
    active: boolean;
  }) => Promise<void>;
}

function RoomFormDialog({
  open,
  onOpenChange,
  editing,
  campuses,
  roomTypes,
  onSave,
}: RoomFormDialogProps) {
  const [campusId, setCampusId] = useState<string>(editing?.campusId ?? "");
  const [roomTypeId, setRoomTypeId] = useState<string>(editing?.roomTypeId ?? "");
  const [code, setCode] = useState(editing?.code ?? "");
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [capacity, setCapacity] = useState(String(editing?.capacity ?? 1));
  const [active, setActive] = useState(editing?.active ?? true);
  const [saving, setSaving] = useState(false);

  const [lastId, setLastId] = useState<string | null>(null);
  if (editing?._id !== lastId) {
    setLastId(editing?._id ?? null);
    setCampusId(editing?.campusId ?? "");
    setRoomTypeId(editing?.roomTypeId ?? "");
    setCode(editing?.code ?? "");
    setName(editing?.name ?? "");
    setDescription(editing?.description ?? "");
    setCapacity(String(editing?.capacity ?? 1));
    setActive(editing?.active ?? true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!roomTypeId) return;
    setSaving(true);
    try {
      await onSave({
        campusId: campusId ? (campusId as Id<"campuses">) : undefined,
        roomTypeId: roomTypeId as Id<"roomTypes">,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim() || undefined,
        capacity: Number(capacity) || 1,
        active,
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
          <DialogTitle>{editing ? "Edit room" : "Add room"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update this room's details."
              : "Add a new bookable room to your facility."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="room-code">Room code</Label>
              <Input
                id="room-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. PH900"
                required
                autoFocus
                className="font-mono"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="room-capacity">Capacity</Label>
              <Input
                id="room-capacity"
                type="number"
                min={0}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="room-name">Room name</Label>
            <Input
              id="room-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Classroom PH900, Ward 1"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="room-type">Room type</Label>
            <Select value={roomTypeId} onValueChange={(v) => setRoomTypeId(v ?? "")} required>
              <SelectTrigger id="room-type">
                <SelectValue placeholder="Select room type…" />
              </SelectTrigger>
              <SelectContent>
                {roomTypes.map((rt) => (
                  <SelectItem key={rt._id} value={rt._id}>
                    {rt.name}
                    {rt.campus ? ` — ${rt.campus.name}` : ""}
                    {!rt.active ? " (inactive)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="room-campus">Campus (optional)</Label>
            <Select value={campusId} onValueChange={(v) => setCampusId(v ?? "")}>
              <SelectTrigger id="room-campus">
                <SelectValue placeholder="Use room type campus / no campus" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Use room type campus</SelectItem>
                {campuses.map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.name}
                    {c.active === false ? " (inactive)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="room-desc">Description (optional)</Label>
            <Textarea
              id="room-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes about layout, equipment, access or typical use…"
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex flex-col gap-0.5">
              <Label className="text-sm font-medium">Active</Label>
              <p className="text-xs text-muted-foreground">
                Inactive rooms cannot be booked.
              </p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !roomTypeId || !code.trim() || !name.trim()}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add room"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type ViewMode = "table" | "grid";

export function RoomsAdmin() {
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
  const rooms = useQuery(api.tenants.listPrivateRooms, {
    tenantSlug,
    auth,
    activeOnly: false,
  });
  const upsertRoom = useMutation(api.tenants.upsertRoom);
  const deleteRoom = useMutation(api.tenants.deleteRoom);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [search, setSearch] = useState("");
  const [filterCampus, setFilterCampus] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");

  const filteredRooms = useMemo(() => {
    if (!rooms) return [];
    return rooms.filter((r) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        r.code.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.roomType?.name.toLowerCase().includes(q) ||
        r.campus?.name.toLowerCase().includes(q);
      const matchCampus = !filterCampus || r.campusId === filterCampus;
      const matchType = !filterType || r.roomTypeId === filterType;
      return matchSearch && matchCampus && matchType;
    });
  }, [rooms, search, filterCampus, filterType]);

  function handleAddNew() {
    setEditingRoom(null);
    setDialogOpen(true);
  }

  async function handleSave(data: Parameters<RoomFormDialogProps["onSave"]>[0]) {
    try {
      await upsertRoom({
        tenantSlug,
        auth,
        roomId: editingRoom?._id ?? undefined,
        ...data,
      });
      toast.success(editingRoom ? "Room updated." : "Room added successfully.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save room.";
      toast.error(msg);
      throw err;
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteRoom({ tenantSlug, auth, roomId: deleteTarget._id });
      toast.success("Room removed.");
    } catch {
      toast.error("Failed to remove room.");
    } finally {
      setDeleteTarget(null);
    }
  }

  const isLoading = rooms === undefined || campuses === undefined || roomTypes === undefined;
  const hasFilters = search || filterCampus || filterType;

  return (
    <div className="flex flex-col gap-8 pb-16">
      <AdminPageHeader
        title="Rooms"
        description="Manage individual bookable rooms. Each room belongs to a room type and optionally a campus."
        breadcrumbs={[{ label: "Rooms" }]}
        actions={
          <Button onClick={handleAddNew} size="sm" className="gap-1.5">
            <PlusIcon className="size-3.5" data-icon="inline-start" />
            Add room
          </Button>
        }
      />

      {/* Filters toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rooms…"
            className="pl-8 h-8 text-sm"
            aria-label="Search rooms"
          />
        </div>

        <Select value={filterCampus} onValueChange={(v) => setFilterCampus(v ?? "")}>
          <SelectTrigger className="h-8 text-sm w-44">
            <SelectValue placeholder="All campuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All campuses</SelectItem>
            {(campuses ?? []).map((c) => (
              <SelectItem key={c._id} value={c._id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterType} onValueChange={(v) => setFilterType(v ?? "")}>
          <SelectTrigger className="h-8 text-sm w-44">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All types</SelectItem>
            {(roomTypes ?? []).map((rt) => (
              <SelectItem key={rt._id} value={rt._id}>
                {rt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setSearch("");
              setFilterCampus("");
              setFilterType("");
            }}
          >
            Clear filters
          </Button>
        )}

        <div className="ml-auto flex items-center gap-0.5 rounded-lg border border-border p-0.5">
          <Button
            variant={viewMode === "table" ? "secondary" : "ghost"}
            size="icon"
            className="size-7"
            onClick={() => setViewMode("table")}
            aria-label="Table view"
          >
            <ListIcon className="size-3.5" />
          </Button>
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            className="size-7"
            onClick={() => setViewMode("grid")}
            aria-label="Grid view"
          >
            <LayoutGridIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Count badge */}
      {!isLoading && rooms && rooms.length > 0 && (
        <p className="text-xs text-muted-foreground -mt-4">
          Showing{" "}
          <span className="font-medium text-foreground">{filteredRooms.length}</span>{" "}
          of <span className="font-medium text-foreground">{rooms.length}</span> rooms
        </p>
      )}

      {/* Table view */}
      {viewMode === "table" && (
        <AdminSettingsCard
          title="Room List"
          description="All rooms across your facility. Click a room to edit it."
          icon={<DoorOpenIcon className="size-4" />}
          noPadding
        >
          {isLoading ? (
            <div className="py-2">
              <TableSkeleton />
            </div>
          ) : rooms.length === 0 ? (
            <EmptyRooms onAdd={handleAddNew} />
          ) : filteredRooms.length === 0 ? (
            <NoResults query={search} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Campus</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-6 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRooms.map((room) => (
                    <TableRow key={room._id}>
                      <TableCell className="pl-6">
                        <span className="font-mono text-xs font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {room.code}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <StatusDot active={room.active} />
                          <div>
                            <p className="font-medium text-foreground">{room.name}</p>
                            {room.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-xs">
                                {room.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {room.campus?.name ?? (
                          <span className="text-border/70 italic">No campus</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {room.roomType?.name ?? "Unknown"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <UsersIcon className="size-3 text-muted-foreground/50" />
                          {room.capacity}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={room.active ? "Active" : "Inactive"} />
                      </TableCell>
                      <TableCell className="pr-6">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => {
                              setEditingRoom(room as unknown as Room);
                              setDialogOpen(true);
                            }}
                            aria-label={`Edit ${room.name}`}
                          >
                            <PencilIcon className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTarget(room as unknown as Room)}
                            aria-label={`Delete ${room.name}`}
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
      )}

      {/* Grid view */}
      {viewMode === "grid" && (
        <>
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-xl" />
              ))}
            </div>
          ) : rooms.length === 0 ? (
            <EmptyRooms onAdd={handleAddNew} />
          ) : filteredRooms.length === 0 ? (
            <NoResults query={search} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredRooms.map((room) => (
                <RoomCard
                  key={room._id}
                  room={room as unknown as Room}
                  onEdit={(r) => {
                    setEditingRoom(r);
                    setDialogOpen(true);
                  }}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          )}
        </>
      )}

      <RoomFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editingRoom}
        campuses={(campuses ?? []) as { _id: Id<"campuses">; name: string; active?: boolean }[]}
        roomTypes={
          (roomTypes ?? []) as {
            _id: Id<"roomTypes">;
            name: string;
            active: boolean;
            campus: { name: string } | null;
          }[]
        }
        onSave={handleSave}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete room?</AlertDialogTitle>
            <AlertDialogDescription>
              {`Delete "${deleteTarget?.name}" (${deleteTarget?.code})? If this room is used in any bookings, it will be deactivated instead of permanently deleted.`}
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
