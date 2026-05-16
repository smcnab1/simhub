"use client";

import { FormEvent, useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useDashboardAuth } from "@/components/dashboard-auth";
import { AdminMenu, Card, SectionHeader, StatusPill } from "@/components/ui";
import type { FormFieldType, Role } from "@/lib/domain";

const fieldTypes: FormFieldType[] = [
  "text",
  "number",
  "textarea",
  "radio",
  "select",
  "checkboxGroup",
  "divider",
  "note",
];

const roles = ["Admin", "Staff", "Requester"] as const satisfies readonly Role[];
type TenantAccountRole = (typeof roles)[number];

const standardFields = [
  { label: "Name", type: "text", required: true },
  { label: "Email", type: "text", required: true },
  { label: "Phone", type: "text", required: false },
  { label: "Session name", type: "text", required: true },
  { label: "Attendees", type: "number", required: true },
  { label: "Details", type: "textarea", required: true },
  { label: "CC emails", type: "text", required: false },
] as const;

function parseEmails(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function submitValue(form: HTMLFormElement, name: string) {
  return String(new FormData(form).get(name) ?? "").trim();
}

function optionalNumber(form: HTMLFormElement, name: string) {
  const raw = submitValue(form, name);
  return raw ? Number(raw) : undefined;
}

export function FacilityAdmin() {
  const auth = useDashboardAuth();
  const tenantSlug = auth.tenantSlug;
  const tenant = useQuery(api.tenants.getPrivateTenant, {
    tenantSlug,
    auth,
  });
  const saveFacility = useMutation(api.tenants.upsertFacilityDetails);
  const [status, setStatus] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;

    await saveFacility({
      tenantSlug,
      auth,
      name: submitValue(form, "name"),
      contactEmail: submitValue(form, "contactEmail"),
      notificationEmails: parseEmails(submitValue(form, "notificationEmails")),
      notificationEmailsEnabled:
        new FormData(form).get("notificationEmailsEnabled") === "on",
      hoursOfOperation: submitValue(form, "hoursOfOperation"),
      uploadMaxBytes:
        Number(submitValue(form, "uploadMaxMb") || 100) * 1024 * 1024,
      minimumAdvanceBookingDays: optionalNumber(
        form,
        "minimumAdvanceBookingDays"
      ),
      maximumAdvanceBookingDays: optionalNumber(
        form,
        "maximumAdvanceBookingDays"
      ),
      bookingNoticeViolationMode:
        submitValue(form, "bookingNoticeViolationMode") === "Warn"
          ? "Warn"
          : "Block",
    });

    setStatus("Facility settings saved.");
  }

  return (
    <>
      <SectionHeader title="Facility Details" eyebrow="Administration" />
      <AdminMenu />
      <Card>
        {tenant ? (
          <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
            <label>
              <span className="text-sm font-semibold text-foreground">
                Facility name
              </span>
              <input
                name="name"
                defaultValue={tenant.name}
                required
                className="mt-1 w-full rounded-xl border border-border bg-card/90 px-3 py-2 shadow-sm"
              />
            </label>

            <label>
              <span className="text-sm font-semibold text-foreground">
                Contact email
              </span>
              <input
                name="contactEmail"
                type="email"
                defaultValue={tenant.contactEmail}
                required
                className="mt-1 w-full rounded-xl border border-border bg-card/90 px-3 py-2 shadow-sm"
              />
            </label>

            <label className="md:col-span-2">
              <span className="text-sm font-semibold text-foreground">
                Notification emails
              </span>
              <input
                name="notificationEmails"
                defaultValue={tenant.notificationEmails.join(", ")}
                className="mt-1 w-full rounded-xl border border-border bg-card/90 px-3 py-2 shadow-sm"
              />
            </label>

            <label className="flex items-center gap-2 md:col-span-2">
              <input
                name="notificationEmailsEnabled"
                type="checkbox"
                defaultChecked={tenant.notificationEmailsEnabled ?? true}
              />
              <span className="text-sm font-semibold text-foreground">
                Send emails to notification recipients
              </span>
            </label>

            <label>
              <span className="text-sm font-semibold text-foreground">
                Hours of operation
              </span>
              <input
                name="hoursOfOperation"
                defaultValue={tenant.hoursOfOperation}
                className="mt-1 w-full rounded-xl border border-border bg-card/90 px-3 py-2 shadow-sm"
              />
            </label>

            <label>
              <span className="text-sm font-semibold text-foreground">
                Upload limit (MB)
              </span>
              <input
                name="uploadMaxMb"
                type="number"
                min="1"
                max="100"
                defaultValue={Math.round(tenant.uploadMaxBytes / 1024 / 1024)}
                className="mt-1 w-full rounded-xl border border-border bg-card/90 px-3 py-2 shadow-sm"
              />
            </label>

            <label>
              <span className="text-sm font-semibold text-foreground">
                Minimum advance notice (days)
              </span>
              <input
                name="minimumAdvanceBookingDays"
                type="number"
                min="0"
                defaultValue={tenant.minimumAdvanceBookingDays ?? ""}
                className="mt-1 w-full rounded-xl border border-border bg-card/90 px-3 py-2 shadow-sm"
              />
            </label>

            <label>
              <span className="text-sm font-semibold text-foreground">
                Maximum future booking window (days)
              </span>
              <input
                name="maximumAdvanceBookingDays"
                type="number"
                min="0"
                defaultValue={tenant.maximumAdvanceBookingDays ?? ""}
                className="mt-1 w-full rounded-xl border border-border bg-card/90 px-3 py-2 shadow-sm"
              />
            </label>

            <label className="md:col-span-2">
              <span className="text-sm font-semibold text-foreground">
                Notice violation handling
              </span>
              <select
                name="bookingNoticeViolationMode"
                defaultValue={tenant.bookingNoticeViolationMode ?? "Block"}
                className="mt-1 w-full rounded-xl border border-border bg-card/90 px-3 py-2 shadow-sm"
              >
                <option value="Block">Block submission</option>
                <option value="Warn">Allow pending approval with warning</option>
              </select>
            </label>

            <div className="flex items-center gap-3 md:col-span-2">
              <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90">
                <Save className="size-4" />
                Save facility
              </button>
              {status ? (
                <p className="text-sm text-primary">{status}</p>
              ) : null}
            </div>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">Loading tenant settings...</p>
        )}
      </Card>
    </>
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

  const [editingId, setEditingId] = useState<Id<"campuses"> | null>(null);

  const editing = useMemo(
    () => campuses?.find((campus) => campus._id === editingId),
    [campuses, editingId]
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    await upsertCampus({
      tenantSlug,
      auth,
      campusId: editingId ?? undefined,
      name: submitValue(form, "name"),
      active: formData.get("active") === "on",
      sortOrder: optionalNumber(form, "sortOrder"),
    });

    form.reset();
    setEditingId(null);
  }

  return (
    <>
      <SectionHeader title="Campuses / Sites" eyebrow="Administration" />
      <AdminMenu />

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <Card>
          <h2 className="font-semibold">
            {editing ? "Edit campus" : "Add campus"}
          </h2>

          <form
            key={editing?._id ?? "new"}
            onSubmit={onSubmit}
            className="mt-4 grid gap-3"
          >
            <label>
              <span className="text-sm font-semibold text-foreground">
                Campus / site name
              </span>
              <input
                name="name"
                defaultValue={editing?.name}
                placeholder="Paragon House"
                required
                className="mt-1 w-full rounded-xl border border-border px-3 py-2"
              />
            </label>

            <label>
              <span className="text-sm font-semibold text-foreground">
                Sort order
              </span>
              <input
                name="sortOrder"
                type="number"
                min="0"
                defaultValue={editing?.sortOrder ?? ""}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2"
              />
            </label>

            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                name="active"
                type="checkbox"
                defaultChecked={editing?.active ?? true}
              />
              Active
            </label>

            <div className="flex gap-2">
              <button className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
                <Plus className="size-4" />
                {editing ? "Save changes" : "Add campus"}
              </button>

              {editing ? (
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="rounded-lg border border-border px-3 py-2 text-sm font-semibold"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </Card>

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-2">Site</th>
                  <th>Sort</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(campuses ?? []).map((campus) => (
                  <tr key={campus._id} className="border-t border-border">
                    <td className="py-3 font-medium">{campus.name}</td>
                    <td>{campus.sortOrder ?? "—"}</td>
                    <td>
                      <StatusPill
                        status={campus.active === false ? "Inactive" : "Active"}
                      />
                    </td>
                    <td className="flex justify-end gap-2 py-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(campus._id)}
                        className="rounded-lg border border-border px-2 py-1 text-xs"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          deleteCampus({
                            tenantSlug,
                            auth,
                            campusId: campus._id,
                          })
                        }
                        className="rounded-lg border border-rose-100 px-2 py-1 text-xs text-rose-700"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {campuses?.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                No campuses configured yet. Add sites such as London Campus,
                Cambridge Campus or another location.
              </p>
            ) : null}
          </div>
        </Card>
      </div>
    </>
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

  const [editingId, setEditingId] = useState<Id<"roomTypes"> | null>(null);

  const editing = useMemo(
    () => roomTypes?.find((roomType) => roomType._id === editingId),
    [editingId, roomTypes]
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const campusId = submitValue(form, "campusId");

    await upsertRoomType({
      tenantSlug,
      auth,
      roomTypeId: editingId ?? undefined,
      campusId: campusId ? (campusId as Id<"campuses">) : undefined,
      name: submitValue(form, "name"),
      description: submitValue(form, "description") || undefined,
      defaultCapacity: Number(submitValue(form, "defaultCapacity") || 0),
      maxBookingDurationMinutes: optionalNumber(form, "maxBookingDurationMinutes"),
      specialRoom: formData.get("specialRoom") === "on",
      active: formData.get("active") === "on",
      sortOrder: optionalNumber(form, "sortOrder"),
    });

    form.reset();
    setEditingId(null);
  }

  return (
    <>
      <SectionHeader title="Room Types" eyebrow="Administration" />
      <AdminMenu />

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <Card>
          <h2 className="font-semibold">
            {editing ? "Edit room type" : "Add room type"}
          </h2>

          <form
            key={editing?._id ?? "new"}
            onSubmit={onSubmit}
            className="mt-4 grid gap-3"
          >
            <label>
              <span className="text-sm font-semibold text-foreground">
                Campus / site
              </span>
              <select
                name="campusId"
                defaultValue={editing?.campusId ?? ""}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2"
              >
                <option value="">All campuses / no specific campus</option>
                {(campuses ?? []).map((campus) => (
                  <option key={campus._id} value={campus._id}>
                    {campus.name}
                    {campus.active === false ? " (inactive)" : ""}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="text-sm font-semibold text-foreground">
                Name
              </span>
              <input
                name="name"
                defaultValue={editing?.name}
                placeholder="Classroom"
                required
                className="mt-1 w-full rounded-xl border border-border px-3 py-2"
              />
            </label>

            <label>
              <span className="text-sm font-semibold text-foreground">
                Description
              </span>
              <textarea
                name="description"
                defaultValue={editing?.description}
                placeholder="Describe the room type, usual layout, limitations or use cases."
                className="mt-1 min-h-24 w-full rounded-xl border border-border px-3 py-2"
              />
            </label>

            <div className="grid grid-cols-3 gap-2">
              <label>
                <span className="text-sm font-semibold text-foreground">
                  Default capacity
                </span>
                <input
                  name="defaultCapacity"
                  type="number"
                  min="0"
                  defaultValue={editing?.defaultCapacity ?? 1}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                />
              </label>

              <label>
                <span className="text-sm font-semibold text-foreground">
                  Max h
                </span>
                <input
                  name="maxBookingDurationMinutes"
                  type="number"
                  min="1"
                  defaultValue={editing?.maxBookingDurationMinutes ?? ""}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                />
              </label>

              <label>
                <span className="text-sm font-semibold text-foreground">
                  Sort
                </span>
                <input
                  name="sortOrder"
                  type="number"
                  min="0"
                  defaultValue={editing?.sortOrder ?? ""}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                />
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                name="specialRoom"
                type="checkbox"
                defaultChecked={editing?.specialRoom}
              />
              Special/non-standard room type
            </label>

            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                name="active"
                type="checkbox"
                defaultChecked={editing?.active ?? true}
              />
              Active
            </label>

            <div className="flex gap-2">
              <button className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
                <Plus className="size-4" />
                {editing ? "Save changes" : "Add room type"}
              </button>

              {editing ? (
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="rounded-lg border border-border px-3 py-2 text-sm font-semibold"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </Card>

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-2">Type</th>
                  <th>Campus</th>
                  <th>Rooms</th>
                  <th>Default capacity</th>
                  <th>Max duration</th>
                  <th>Status</th>
                  <th>Flags</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(roomTypes ?? []).map((roomType) => (
                  <tr key={roomType._id} className="border-t border-border">
                    <td className="py-3">
                      <p className="font-medium">{roomType.name}</p>
                      {roomType.description ? (
                        <p className="max-w-xs truncate text-xs text-muted-foreground">
                          {roomType.description}
                        </p>
                      ) : null}
                    </td>
                    <td>{roomType.campus?.name ?? "All campuses"}</td>
                    <td>
                      {roomType.activeRoomCount ?? 0}/{roomType.roomCount ?? 0}
                    </td>
                    <td>{roomType.defaultCapacity}</td>
                    <td>
                      {roomType.maxBookingDurationMinutes
                        ? `${roomType.maxBookingDurationMinutes} min`
                        : "No limit"}
                    </td>
                    <td>
                      <StatusPill
                        status={roomType.active ? "Active" : "Inactive"}
                      />
                    </td>
                    <td>
                      {roomType.specialRoom ? (
                        <StatusPill status="Special" />
                      ) : (
                        "Room"
                      )}
                    </td>
                    <td className="flex justify-end gap-2 py-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(roomType._id)}
                        className="rounded-lg border border-border px-2 py-1 text-xs"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          deleteRoomType({
                            tenantSlug,
                            auth,
                            roomTypeId: roomType._id,
                          })
                        }
                        className="rounded-lg border border-rose-100 px-2 py-1 text-xs text-rose-700"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {roomTypes?.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                No room types configured yet.
              </p>
            ) : null}
          </div>
        </Card>
      </div>
    </>
  );
}

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

  const [editingId, setEditingId] = useState<Id<"rooms"> | null>(null);

  const editing = useMemo(
    () => rooms?.find((room) => room._id === editingId),
    [editingId, rooms]
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    const campusId = submitValue(form, "campusId");
    const roomTypeId = submitValue(form, "roomTypeId");

    if (!roomTypeId) return;

    await upsertRoom({
      tenantSlug,
      auth,
      roomId: editingId ?? undefined,
      campusId: campusId ? (campusId as Id<"campuses">) : undefined,
      roomTypeId: roomTypeId as Id<"roomTypes">,
      code: submitValue(form, "code"),
      name: submitValue(form, "name"),
      description: submitValue(form, "description") || undefined,
      capacity: Number(submitValue(form, "capacity") || 0),
      active: formData.get("active") === "on",
    });

    form.reset();
    setEditingId(null);
  }

  return (
    <>
      <SectionHeader title="Rooms" eyebrow="Administration" />
      <AdminMenu />

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <Card>
          <h2 className="font-semibold">
            {editing ? "Edit room" : "Add room"}
          </h2>

          <form
            key={editing?._id ?? "new"}
            onSubmit={onSubmit}
            className="mt-4 grid gap-3"
          >
            <label>
              <span className="text-sm font-semibold text-foreground">
                Room code
              </span>
              <input
                name="code"
                defaultValue={editing?.code}
                placeholder="PH900"
                required
                className="mt-1 w-full rounded-xl border border-border px-3 py-2"
              />
            </label>

            <label>
              <span className="text-sm font-semibold text-foreground">
                Room name
              </span>
              <input
                name="name"
                defaultValue={editing?.name}
                placeholder="Classroom PH900"
                required
                className="mt-1 w-full rounded-xl border border-border px-3 py-2"
              />
            </label>

            <label>
              <span className="text-sm font-semibold text-foreground">
                Campus / site
              </span>
              <select
                name="campusId"
                defaultValue={editing?.campusId ?? ""}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2"
              >
                <option value="">Use room type campus / no campus</option>
                {(campuses ?? []).map((campus) => (
                  <option key={campus._id} value={campus._id}>
                    {campus.name}
                    {campus.active === false ? " (inactive)" : ""}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="text-sm font-semibold text-foreground">
                Room type
              </span>
              <select
                name="roomTypeId"
                defaultValue={editing?.roomTypeId ?? ""}
                required
                className="mt-1 w-full rounded-xl border border-border px-3 py-2"
              >
                <option value="">Select room type...</option>
                {(roomTypes ?? []).map((roomType) => (
                  <option key={roomType._id} value={roomType._id}>
                    {roomType.name}
                    {roomType.campus ? ` - ${roomType.campus.name}` : ""}
                    {roomType.active === false ? " (inactive)" : ""}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="text-sm font-semibold text-foreground">
                Capacity
              </span>
              <input
                name="capacity"
                type="number"
                min="0"
                defaultValue={editing?.capacity ?? 1}
                required
                className="mt-1 w-full rounded-xl border border-border px-3 py-2"
              />
            </label>

            <label>
              <span className="text-sm font-semibold text-foreground">
                Description
              </span>
              <textarea
                name="description"
                defaultValue={editing?.description}
                placeholder="Brief notes about the room, layout, limitations or usual use."
                className="mt-1 min-h-24 w-full rounded-xl border border-border px-3 py-2"
              />
            </label>

            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                name="active"
                type="checkbox"
                defaultChecked={editing?.active ?? true}
              />
              Active / available for bookings
            </label>

            <div className="flex gap-2">
              <button className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
                <Plus className="size-4" />
                {editing ? "Save changes" : "Add room"}
              </button>

              {editing ? (
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="rounded-lg border border-border px-3 py-2 text-sm font-semibold"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </Card>

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-2">Code</th>
                  <th>Name</th>
                  <th>Campus</th>
                  <th>Type</th>
                  <th>Capacity</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(rooms ?? []).map((room) => (
                  <tr key={room._id} className="border-t border-border">
                    <td className="py-3 font-medium">{room.code}</td>
                    <td>
                      <div>
                        <p className="font-medium">{room.name}</p>
                        {room.description ? (
                          <p className="max-w-xs truncate text-xs text-muted-foreground">
                            {room.description}
                          </p>
                        ) : null}
                      </div>
                    </td>
                    <td>{room.campus?.name ?? "No campus"}</td>
                    <td>{room.roomType?.name ?? "Unknown type"}</td>
                    <td>{room.capacity}</td>
                    <td>
                      <StatusPill
                        status={room.active ? "Active" : "Inactive"}
                      />
                    </td>
                    <td className="flex justify-end gap-2 py-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(room._id)}
                        className="rounded-lg border border-border px-2 py-1 text-xs"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          deleteRoom({
                            tenantSlug,
                            auth,
                            roomId: room._id,
                          })
                        }
                        className="rounded-lg border border-rose-100 px-2 py-1 text-xs text-rose-700"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {rooms?.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                No rooms configured yet. Add room types first, then create
                physical rooms such as PH900, PH901 or Ward 1.
              </p>
            ) : null}
          </div>
        </Card>
      </div>
    </>
  );
}

export function RequestFormAdmin() {
  const auth = useDashboardAuth();
  const tenantSlug = auth.tenantSlug;
  const formConfig = useQuery(api.tenants.getPrivateFormConfig, {
    tenantSlug,
    auth,
  });
  const saveForm = useMutation(api.tenants.upsertFormConfig);
  const fields = formConfig?.fields ?? [];
  const [draftFields, setDraftFields] = useState<typeof fields | null>(null);
  const activeFields = draftFields ?? fields;

  async function save() {
    await saveForm({
      tenantSlug,
      auth,
      fileUploadEnabled: Boolean(formConfig?.fileUploadEnabled),
      fields: activeFields,
    });
  }

  async function toggleUploads(fileUploadEnabled: boolean) {
    await saveForm({
      tenantSlug,
      auth,
      fileUploadEnabled,
      fields: activeFields,
    });
  }

  return (
    <>
      <SectionHeader
        title="Booking Request Form"
        eyebrow="Administration"
        action={
          <button
            onClick={() =>
              setDraftFields([
                ...activeFields,
                {
                  id: crypto.randomUUID(),
                  label: "Custom question",
                  type: "text",
                  required: false,
                },
              ])
            }
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90"
          >
            <Plus className="size-4" />
            Add field
          </button>
        }
      />

      <AdminMenu />

      <Card>
        <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Standard fields</h2>
            <p className="text-sm text-muted-foreground">
              These are required by SimHQ and cannot be removed.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(formConfig?.fileUploadEnabled)}
              onChange={(event) => toggleUploads(event.target.checked)}
            />
            File upload enabled
          </label>
        </div>

        <div className="mt-3 grid gap-2">
          {standardFields.map((field) => (
            <div
              key={field.label}
              className="flex items-center justify-between rounded-xl border border-border bg-muted/40 p-3"
            >
              <div>
                <p className="font-medium">{field.label}</p>
                <p className="text-sm text-muted-foreground">{field.type} · locked</p>
              </div>
              <StatusPill status={field.required ? "Required" : "Optional"} />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Custom fields</h2>
          <button
            onClick={save}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Save className="size-4" />
            Save form
          </button>
        </div>

        <div className="mt-3 grid gap-2">
          {activeFields.map((field, index) => (
            <div
              key={field.id}
              className="grid gap-2 rounded-xl border border-border bg-muted/40 p-3 md:grid-cols-[1fr_160px_100px_auto]"
            >
              <input
                value={field.label}
                onChange={(event) =>
                  setDraftFields(
                    activeFields.map((item) =>
                      item.id === field.id
                        ? { ...item, label: event.target.value }
                        : item
                    )
                  )
                }
                className="rounded-lg border border-border px-3 py-2 text-sm"
              />

              <select
                value={field.type}
                onChange={(event) =>
                  setDraftFields(
                    activeFields.map((item) =>
                      item.id === field.id
                        ? {
                            ...item,
                            type: event.target.value as FormFieldType,
                          }
                        : item
                    )
                  )
                }
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                {fieldTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(event) =>
                    setDraftFields(
                      activeFields.map((item) =>
                        item.id === field.id
                          ? { ...item, required: event.target.checked }
                          : item
                      )
                    )
                  }
                />
                Required
              </label>

              <button
                onClick={() =>
                  setDraftFields(
                    activeFields.filter((_, itemIndex) => itemIndex !== index)
                  )
                }
                className="rounded-lg border border-rose-100 px-2 text-rose-700"
              >
                <Trash2 className="size-4" />
              </button>

              <input
                value={field.helpText ?? ""}
                onChange={(event) =>
                  setDraftFields(
                    activeFields.map((item) =>
                      item.id === field.id
                        ? {
                            ...item,
                            helpText: event.target.value || undefined,
                          }
                        : item
                    )
                  )
                }
                placeholder="Help text"
                className="rounded-lg border border-border px-3 py-2 text-sm md:col-span-2"
              />

              <input
                value={field.options?.join(", ") ?? ""}
                onChange={(event) =>
                  setDraftFields(
                    activeFields.map((item) =>
                      item.id === field.id
                        ? {
                            ...item,
                            options: parseEmails(event.target.value),
                          }
                        : item
                    )
                  )
                }
                placeholder="Options for select/radio/checkbox, comma separated"
                className="rounded-lg border border-border px-3 py-2 text-sm md:col-span-2"
              />
            </div>
          ))}

          {activeFields.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No custom request fields configured yet.
            </p>
          ) : null}
        </div>
      </Card>
    </>
  );
}

export function AccountsAdmin() {
  const auth = useDashboardAuth();
  const tenantSlug = auth.tenantSlug;
  const users = useQuery(api.tenants.listUsers, { tenantSlug, auth });
  const upsertUser = useMutation(api.tenants.upsertUser);
  const deleteUser = useMutation(api.tenants.deleteUser);
  const [editingId, setEditingId] = useState<Id<"users"> | null>(null);
  const editing = users?.find((user) => user._id === editingId);
  const editingDeveloper = editing?.role === "Developer";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;

    await upsertUser({
      tenantSlug,
      auth,
      userId: editingId ?? undefined,
      name: submitValue(form, "name"),
      email: submitValue(form, "email"),
      role: submitValue(form, "role") as TenantAccountRole,
    });

    form.reset();
    setEditingId(null);
  }

  return (
    <>
      <SectionHeader title="Accounts" eyebrow="Administration" />
      <AdminMenu />

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <Card>
          <h2 className="font-semibold">
            {editingDeveloper ? "Developer account" : editing ? "Edit user" : "Add user"}
          </h2>

          {editingDeveloper ? (
            <div className="mt-4 rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground">
              Developer users are managed by bootstrap tooling.
            </div>
          ) : (
            <form
              key={editing?._id ?? "new"}
              onSubmit={onSubmit}
              className="mt-4 grid gap-3"
            >
              <input
                name="name"
                defaultValue={editing?.name}
                placeholder="Name"
                required
                className="rounded-xl border border-border px-3 py-2"
              />

              <input
                name="email"
                type="email"
                defaultValue={editing?.email}
                placeholder="Email"
                required
                className="rounded-xl border border-border px-3 py-2"
              />

              <select
                name="role"
                defaultValue={editing?.role ?? "Staff"}
                className="rounded-xl border border-border px-3 py-2"
              >
                {roles.map((role) => (
                  <option key={role}>{role}</option>
                ))}
              </select>

              <button className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
                {editing ? "Save user" : "Add user"}
              </button>
            </form>
          )}
        </Card>

        <Card>
          {(users ?? []).map((user) => (
            <div
              key={user._id}
              className="flex items-center justify-between border-b border-border py-3 last:border-0"
            >
              <div>
                <p className="font-medium">{user.name}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>

              <div className="flex items-center gap-2">
                <StatusPill status={user.role} />
                {user.role === "Developer" ? null : (
                  <>
                    <button
                      onClick={() => setEditingId(user._id)}
                      className="rounded-lg border border-border px-2 py-1 text-xs"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() =>
                        deleteUser({
                          tenantSlug,
                          auth,
                          userId: user._id,
                        })
                      }
                      className="rounded-lg border border-rose-100 px-2 py-1 text-xs text-rose-700"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}

          {users?.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No users configured in Convex yet.
            </p>
          ) : null}
        </Card>
      </div>
    </>
  );
}
