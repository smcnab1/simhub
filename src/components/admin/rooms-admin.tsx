"use client";

import { useState, useMemo, useEffect } from "react";
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
  UsersIcon,
  SearchIcon,
  LayoutGridIcon,
  ListIcon,
  ImageIcon,
  XIcon,
  ArchiveIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Room = {
  _id: Id<"rooms">;
  code: string;
  name: string;
  description?: string;
  capacity: number;
  imageStorageId?: Id<"_storage">;
  imageUrl?: string | null;
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
  onArchive: (room: Room) => void;
}

function RoomThumbnail({ room }: { room: Pick<Room, "name" | "imageUrl"> }) {
  return (
    <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
      {room.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={room.imageUrl} alt="" className="size-full object-cover" />
      ) : (
        <ImageIcon className="size-4 text-muted-foreground" />
      )}
    </div>
  );
}

function RoomCard({ room, onEdit, onArchive }: RoomCardProps) {
  return (
    <div className={cn(
      "flex flex-col gap-3 rounded-xl border border-border p-4 bg-card shadow-sm",
      !room.active && "opacity-60"
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <RoomThumbnail room={room} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold text-muted-foreground">
                {room.code}
              </span>
              <StatusDot active={room.active} />
            </div>
            <p className="mt-1 truncate font-medium text-foreground">{room.name}</p>
          </div>
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
          onClick={() => onArchive(room)}
        >
          <ArchiveIcon className="size-3" />
          Archive
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
    imageStorageId?: Id<"_storage">;
    removeImage?: boolean;
    active: boolean;
  }) => Promise<void>;
  onUploadImage: (file: File) => Promise<Id<"_storage">>;
  existingCodes: Array<{ id: Id<"rooms">; code: string }>;
}

function RoomFormDialog({
  open,
  onOpenChange,
  editing,
  campuses,
  roomTypes,
  onSave,
  onUploadImage,
  existingCodes,
}: RoomFormDialogProps) {
  const [campusId, setCampusId] = useState<string>(editing?.campusId ?? "");
  const [roomTypeId, setRoomTypeId] = useState<string>(editing?.roomTypeId ?? "");
  const [code, setCode] = useState(editing?.code ?? "");
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [capacity, setCapacity] = useState(String(editing?.capacity ?? 1));
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(editing?.imageUrl ?? null);
  const [removeImage, setRemoveImage] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [active, setActive] = useState(editing?.active ?? true);
  const [saving, setSaving] = useState(false);
  const selectableRoomTypes = useMemo(
    () =>
      roomTypes.filter(
        (roomType) => roomType.active || roomType._id === editing?.roomTypeId
      ),
    [roomTypes, editing?.roomTypeId]
  );
  const selectedRoomType = selectableRoomTypes.find((rt) => rt._id === roomTypeId);
  const selectedCampus = campuses.find((campus) => campus._id === campusId);
  const selectedRoomTypeLabel = selectedRoomType
    ? `${selectedRoomType.name}${selectedRoomType.campus ? ` — ${selectedRoomType.campus.name}` : ""}${!selectedRoomType.active ? " (inactive)" : ""}`
    : undefined;
  const selectedCampusLabel = selectedCampus
    ? `${selectedCampus.name}${selectedCampus.active === false ? " (inactive)" : ""}`
    : "Use room type campus";

  useEffect(() => {
    return () => {
      if (imagePreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  function handleImageChange(file: File | undefined) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setFormError("Room image must be an image file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setFormError("Room image must be 10 MB or smaller.");
      return;
    }

    if (imagePreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setRemoveImage(false);
    setFormError(null);
  }

  function handleRemoveImage() {
    if (imagePreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    setImageFile(null);
    setImagePreviewUrl(null);
    setRemoveImage(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!roomTypeId) return;
    const trimmedCode = code.trim().toUpperCase();
    const trimmedName = name.trim();
    const parsedCapacity = Number(capacity);
    const duplicate = existingCodes.some(
      (room) => room.code.toUpperCase() === trimmedCode && room.id !== editing?._id
    );

    if (!trimmedCode) {
      setFormError("Room code is required.");
      return;
    }

    if (duplicate) {
      setFormError("A room with this code already exists.");
      return;
    }

    if (!trimmedName) {
      setFormError("Room name is required.");
      return;
    }

    if (!Number.isFinite(parsedCapacity) || parsedCapacity < 0) {
      setFormError("Capacity must be zero or greater.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const imageStorageId = imageFile ? await onUploadImage(imageFile) : undefined;

      await onSave({
        campusId: campusId ? (campusId as Id<"campuses">) : undefined,
        roomTypeId: roomTypeId as Id<"roomTypes">,
        code: trimmedCode,
        name: trimmedName,
        description: description.trim() || undefined,
        capacity: parsedCapacity,
        imageStorageId,
        removeImage: removeImage && !imageStorageId,
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

          <div className="flex flex-col gap-2">
            <Label htmlFor="room-image">Room image</Label>
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
              <div className="flex h-20 w-28 items-center justify-center overflow-hidden rounded-md bg-muted">
                {imagePreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imagePreviewUrl} alt="" className="size-full object-cover" />
                ) : (
                  <ImageIcon className="size-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex min-w-48 flex-1 flex-col gap-2">
                <Input
                  id="room-image"
                  type="file"
                  accept="image/*"
                  onChange={(event) => handleImageChange(event.target.files?.[0])}
                />
                <div className="flex flex-wrap gap-2">
                  {imagePreviewUrl ? (
                    <Button type="button" variant="ghost" size="sm" onClick={handleRemoveImage}>
                      <XIcon className="size-3.5" />
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>
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
                <SelectValue placeholder="Select room type…">
                  {selectedRoomTypeLabel}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {selectableRoomTypes.map((rt) => (
                  <SelectItem
                    key={rt._id}
                    value={rt._id}
                    label={`${rt.name}${rt.campus ? ` — ${rt.campus.name}` : ""}${!rt.active ? " (inactive)" : ""}`}
                  >
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
                <SelectValue>{selectedCampusLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="" label="Use room type campus">
                  Use room type campus
                </SelectItem>
                {campuses.map((c) => (
                  <SelectItem
                    key={c._id}
                    value={c._id}
                    label={`${c.name}${c.active === false ? " (inactive)" : ""}`}
                  >
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
type StatusFilter = "active" | "inactive" | "all";

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
  const generateRoomImageUploadUrl = useMutation(api.files.generateRoomImageUploadUrl);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [search, setSearch] = useState("");
  const [filterCampus, setFilterCampus] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("active");

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
      const matchStatus =
        filterStatus === "all" ||
        (filterStatus === "active" ? r.active : !r.active);
      return matchSearch && matchCampus && matchType && matchStatus;
    });
  }, [rooms, search, filterCampus, filterType, filterStatus]);

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

  async function handleUploadImage(file: File) {
    const url = await generateRoomImageUploadUrl({
      tenantSlug,
      auth,
      sizeBytes: file.size,
    });
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });

    if (!response.ok) {
      throw new Error("Failed to upload room image.");
    }

    const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
    return storageId;
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteRoom({ tenantSlug, auth, roomId: deleteTarget._id });
      toast.success("Room archived.");
    } catch {
      toast.error("Failed to archive room.");
    } finally {
      setDeleteTarget(null);
    }
  }

  const isLoading = rooms === undefined || campuses === undefined || roomTypes === undefined;
  const hasFilters = search || filterCampus || filterType || filterStatus !== "active";
  const activeRoomCount = rooms?.filter((room) => room.active).length ?? 0;
  const inactiveRoomCount = rooms?.filter((room) => !room.active).length ?? 0;

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

        <Select value={filterStatus} onValueChange={(v) => setFilterStatus((v as StatusFilter) ?? "active")}>
          <SelectTrigger className="h-8 w-44 text-sm">
            <SelectValue placeholder="Active rooms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active rooms</SelectItem>
            <SelectItem value="inactive">Archived rooms</SelectItem>
            <SelectItem value="all">All rooms</SelectItem>
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
              setFilterStatus("active");
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
          <span className="ml-2 text-muted-foreground">
            {activeRoomCount} active · {inactiveRoomCount} archived
          </span>
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
                    <TableHead>Image</TableHead>
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
                        <RoomThumbnail room={room as Room} />
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
                            aria-label={`Archive ${room.name}`}
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
                  onArchive={setDeleteTarget}
                />
              ))}
            </div>
          )}
        </>
      )}

      <RoomFormDialog
        key={`${dialogOpen ? "open" : "closed"}-${editingRoom?._id ?? "new"}`}
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
        onUploadImage={handleUploadImage}
        existingCodes={(rooms ?? []).map((room) => ({
          id: room._id,
          code: room.code,
        }))}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive room?</AlertDialogTitle>
            <AlertDialogDescription>
              {`Archive "${deleteTarget?.name}" (${deleteTarget?.code})? It will be hidden from new booking choices and resource views, while historic bookings keep showing the room.`}
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
