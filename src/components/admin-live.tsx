"use client";

import { FormEvent, useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { AdminMenu, Card, SectionHeader, StatusPill } from "@/components/ui";
import { TENANT_SLUG } from "@/lib/config";
import type { FormFieldType, Role } from "@/lib/domain";

const fieldTypes: FormFieldType[] = ["text", "number", "textarea", "radio", "select", "checkboxGroup", "divider", "note"];
const roles: Role[] = ["Admin", "Staff", "Requester"];

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
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function submitValue(form: HTMLFormElement, name: string) {
  return String(new FormData(form).get(name) ?? "").trim();
}

export function FacilityAdmin() {
  const tenant = useQuery(api.tenants.getPrivateTenant, { tenantSlug: TENANT_SLUG });
  const saveFacility = useMutation(api.tenants.upsertFacilityDetails);
  const [status, setStatus] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    await saveFacility({
      tenantSlug: TENANT_SLUG,
      name: submitValue(form, "name"),
      contactEmail: submitValue(form, "contactEmail"),
      notificationEmails: parseEmails(submitValue(form, "notificationEmails")),
      hoursOfOperation: submitValue(form, "hoursOfOperation"),
      uploadMaxBytes: Number(submitValue(form, "uploadMaxMb") || 100) * 1024 * 1024,
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
            <label><span className="text-sm font-semibold text-slate-700">Facility name</span><input name="name" defaultValue={tenant.name} required className="mt-1 w-full rounded-xl border border-blue-100 bg-white/90 px-3 py-2 shadow-sm" /></label>
            <label><span className="text-sm font-semibold text-slate-700">Contact email</span><input name="contactEmail" type="email" defaultValue={tenant.contactEmail} required className="mt-1 w-full rounded-xl border border-blue-100 bg-white/90 px-3 py-2 shadow-sm" /></label>
            <label className="md:col-span-2"><span className="text-sm font-semibold text-slate-700">Notification emails</span><input name="notificationEmails" defaultValue={tenant.notificationEmails.join(", ")} className="mt-1 w-full rounded-xl border border-blue-100 bg-white/90 px-3 py-2 shadow-sm" /></label>
            <label><span className="text-sm font-semibold text-slate-700">Hours of operation</span><input name="hoursOfOperation" defaultValue={tenant.hoursOfOperation} className="mt-1 w-full rounded-xl border border-blue-100 bg-white/90 px-3 py-2 shadow-sm" /></label>
            <label><span className="text-sm font-semibold text-slate-700">Upload limit (MB)</span><input name="uploadMaxMb" type="number" min="1" max="100" defaultValue={Math.round(tenant.uploadMaxBytes / 1024 / 1024)} className="mt-1 w-full rounded-xl border border-blue-100 bg-white/90 px-3 py-2 shadow-sm" /></label>
            <div className="flex items-center gap-3 md:col-span-2">
              <button className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700"><Save className="size-4" /> Save facility</button>
              {status ? <p className="text-sm text-emerald-700">{status}</p> : null}
            </div>
          </form>
        ) : <p className="text-sm text-slate-500">Loading tenant settings...</p>}
      </Card>
    </>
  );
}

export function RoomTypesAdmin() {
  const roomTypes = useQuery(api.tenants.listPrivateRoomTypes, { tenantSlug: TENANT_SLUG });
  const upsertRoomType = useMutation(api.tenants.upsertRoomType);
  const deleteRoomType = useMutation(api.tenants.deleteRoomType);
  const [editingId, setEditingId] = useState<Id<"roomTypes"> | null>(null);

  const editing = useMemo(() => roomTypes?.find((room) => room._id === editingId), [editingId, roomTypes]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    await upsertRoomType({
      tenantSlug: TENANT_SLUG,
      roomTypeId: editingId ?? undefined,
      name: submitValue(form, "name"),
      quantity: Number(submitValue(form, "quantity") || 0),
      capacity: Number(submitValue(form, "capacity") || 0),
      maxDurationHours: Number(submitValue(form, "maxDurationHours") || 1),
      isSpecial: new FormData(form).get("isSpecial") === "on",
    });
    form.reset();
    setEditingId(null);
  }

  return (
    <>
      <SectionHeader title="Room Types & Quantities" eyebrow="Administration" />
      <AdminMenu />
      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <Card>
          <h2 className="font-semibold">{editing ? "Edit room type" : "Add room type"}</h2>
          <form key={editing?._id ?? "new"} onSubmit={onSubmit} className="mt-4 grid gap-3">
            <label><span className="text-sm font-semibold text-slate-700">Name</span><input name="name" defaultValue={editing?.name} required className="mt-1 w-full rounded-xl border border-blue-100 px-3 py-2" /></label>
            <div className="grid grid-cols-3 gap-2">
              <label><span className="text-sm font-semibold text-slate-700">Qty</span><input name="quantity" type="number" min="0" defaultValue={editing?.quantity ?? 1} className="mt-1 w-full rounded-xl border border-blue-100 px-3 py-2" /></label>
              <label><span className="text-sm font-semibold text-slate-700">Capacity</span><input name="capacity" type="number" min="0" defaultValue={editing?.capacity ?? 1} className="mt-1 w-full rounded-xl border border-blue-100 px-3 py-2" /></label>
              <label><span className="text-sm font-semibold text-slate-700">Max h</span><input name="maxDurationHours" type="number" min="1" defaultValue={editing?.maxDurationHours ?? 2} className="mt-1 w-full rounded-xl border border-blue-100 px-3 py-2" /></label>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input name="isSpecial" type="checkbox" defaultChecked={editing?.isSpecial} /> Special/non-room type</label>
            <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white"><Plus className="size-4" /> {editing ? "Save changes" : "Add room type"}</button>
          </form>
        </Card>
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500"><tr><th className="py-2">Type</th><th>Qty</th><th>Capacity</th><th>Max duration</th><th>Flags</th><th /></tr></thead>
              <tbody>
                {(roomTypes ?? []).map((room) => (
                  <tr key={room._id} className="border-t border-blue-100">
                    <td className="py-3 font-medium">{room.name}</td>
                    <td>{room.quantity}</td>
                    <td>{room.capacity}</td>
                    <td>{room.maxDurationHours}h</td>
                    <td>{room.isSpecial ? <StatusPill status="Special" /> : "Room"}</td>
                    <td className="flex justify-end gap-2 py-2">
                      <button type="button" onClick={() => setEditingId(room._id)} className="rounded-lg border border-blue-100 px-2 py-1 text-xs">Edit</button>
                      <button type="button" onClick={() => deleteRoomType({ tenantSlug: TENANT_SLUG, roomTypeId: room._id })} className="rounded-lg border border-rose-100 px-2 py-1 text-xs text-rose-700"><Trash2 className="size-3" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {roomTypes?.length === 0 ? <p className="py-4 text-sm text-slate-500">No room types configured in Convex yet.</p> : null}
          </div>
        </Card>
      </div>
    </>
  );
}

export function RequestFormAdmin() {
  const formConfig = useQuery(api.tenants.getPrivateFormConfig, { tenantSlug: TENANT_SLUG });
  const saveForm = useMutation(api.tenants.upsertFormConfig);
  const fields = formConfig?.fields ?? [];
  const [draftFields, setDraftFields] = useState<typeof fields | null>(null);
  const activeFields = draftFields ?? fields;

  async function save() {
    await saveForm({
      tenantSlug: TENANT_SLUG,
      fileUploadEnabled: Boolean(formConfig?.fileUploadEnabled),
      fields: activeFields,
    });
  }

  async function toggleUploads(fileUploadEnabled: boolean) {
    await saveForm({ tenantSlug: TENANT_SLUG, fileUploadEnabled, fields: activeFields });
  }

  return (
    <>
      <SectionHeader title="Booking Request Form" eyebrow="Administration" action={<button onClick={() => setDraftFields([...activeFields, { id: crypto.randomUUID(), label: "Custom question", type: "text", required: false }])} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700"><Plus className="size-4" /> Add field</button>} />
      <AdminMenu />
      <Card>
        <div className="flex flex-col gap-3 border-b border-blue-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Standard fields</h2>
            <p className="text-sm text-slate-500">These are required by SimHub and cannot be removed.</p>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(formConfig?.fileUploadEnabled)} onChange={(event) => toggleUploads(event.target.checked)} /> File upload enabled</label>
        </div>
        <div className="mt-3 grid gap-2">
          {standardFields.map((field) => (
            <div key={field.label} className="flex items-center justify-between rounded-xl border border-blue-100 bg-white/60 p-3">
              <div><p className="font-medium">{field.label}</p><p className="text-sm text-slate-500">{field.type} · locked</p></div>
              <StatusPill status={field.required ? "Required" : "Optional"} />
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Custom fields</h2>
          <button onClick={save} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white"><Save className="size-4" /> Save form</button>
        </div>
        <div className="mt-3 grid gap-2">
          {activeFields.map((field, index) => (
            <div key={field.id} className="grid gap-2 rounded-xl border border-blue-100 bg-white/60 p-3 md:grid-cols-[1fr_160px_100px_auto]">
              <input value={field.label} onChange={(event) => setDraftFields(activeFields.map((item) => item.id === field.id ? { ...item, label: event.target.value } : item))} className="rounded-lg border border-blue-100 px-3 py-2 text-sm" />
              <select value={field.type} onChange={(event) => setDraftFields(activeFields.map((item) => item.id === field.id ? { ...item, type: event.target.value as FormFieldType } : item))} className="rounded-lg border border-blue-100 px-3 py-2 text-sm">
                {fieldTypes.map((type) => <option key={type}>{type}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={field.required} onChange={(event) => setDraftFields(activeFields.map((item) => item.id === field.id ? { ...item, required: event.target.checked } : item))} /> Required</label>
              <button onClick={() => setDraftFields(activeFields.filter((_, itemIndex) => itemIndex !== index))} className="rounded-lg border border-rose-100 px-2 text-rose-700"><Trash2 className="size-4" /></button>
              <input value={field.helpText ?? ""} onChange={(event) => setDraftFields(activeFields.map((item) => item.id === field.id ? { ...item, helpText: event.target.value || undefined } : item))} placeholder="Help text" className="rounded-lg border border-blue-100 px-3 py-2 text-sm md:col-span-2" />
              <input value={field.options?.join(", ") ?? ""} onChange={(event) => setDraftFields(activeFields.map((item) => item.id === field.id ? { ...item, options: parseEmails(event.target.value) } : item))} placeholder="Options for select/radio/checkbox, comma separated" className="rounded-lg border border-blue-100 px-3 py-2 text-sm md:col-span-2" />
            </div>
          ))}
          {activeFields.length === 0 ? <p className="text-sm text-slate-500">No custom request fields configured yet.</p> : null}
        </div>
      </Card>
    </>
  );
}

export function AccountsAdmin() {
  const users = useQuery(api.tenants.listUsers, { tenantSlug: TENANT_SLUG });
  const upsertUser = useMutation(api.tenants.upsertUser);
  const deleteUser = useMutation(api.tenants.deleteUser);
  const [editingId, setEditingId] = useState<Id<"users"> | null>(null);
  const editing = users?.find((user) => user._id === editingId);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    await upsertUser({
      tenantSlug: TENANT_SLUG,
      userId: editingId ?? undefined,
      name: submitValue(form, "name"),
      email: submitValue(form, "email"),
      role: submitValue(form, "role") as Role,
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
          <h2 className="font-semibold">{editing ? "Edit user" : "Add user"}</h2>
          <form key={editing?._id ?? "new"} onSubmit={onSubmit} className="mt-4 grid gap-3">
            <input name="name" defaultValue={editing?.name} placeholder="Name" required className="rounded-xl border border-blue-100 px-3 py-2" />
            <input name="email" type="email" defaultValue={editing?.email} placeholder="Email" required className="rounded-xl border border-blue-100 px-3 py-2" />
            <select name="role" defaultValue={editing?.role ?? "Staff"} className="rounded-xl border border-blue-100 px-3 py-2">
              {roles.map((role) => <option key={role}>{role}</option>)}
            </select>
            <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white">{editing ? "Save user" : "Add user"}</button>
          </form>
        </Card>
        <Card>
          {(users ?? []).map((user) => (
            <div key={user._id} className="flex items-center justify-between border-b border-blue-100 py-3 last:border-0">
              <div>
                <p className="font-medium">{user.name}</p>
                <p className="text-sm text-slate-500">{user.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill status={user.role} />
                <button onClick={() => setEditingId(user._id)} className="rounded-lg border border-blue-100 px-2 py-1 text-xs">Edit</button>
                <button onClick={() => deleteUser({ tenantSlug: TENANT_SLUG, userId: user._id })} className="rounded-lg border border-rose-100 px-2 py-1 text-xs text-rose-700"><Trash2 className="size-3" /></button>
              </div>
            </div>
          ))}
          {users?.length === 0 ? <p className="text-sm text-slate-500">No users configured in Convex yet.</p> : null}
        </Card>
      </div>
    </>
  );
}
