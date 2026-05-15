"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Card, SectionHeader, formFieldClass, primaryButtonClass, subtleButtonClass } from "@/components/ui";
import { formatBookingDuration } from "@/lib/booking-logic";
import { TENANT_SLUG } from "@/lib/config";

function value(form: HTMLFormElement, name: string) {
  return String(new FormData(form).get(name) ?? "").trim();
}

function emails(input: string) {
  return input.split(",").map((item) => item.trim()).filter(Boolean);
}

function iso(date: string, time: string) {
  return new Date(`${date}T${time}`).toISOString();
}

function renderCustomField(field: {
  id: string;
  label: string;
  type: string;
  required: boolean;
  helpText?: string;
  options?: string[];
}) {
  if (field.type === "divider") return <hr className="my-2 border-border md:col-span-2" />;
  if (field.type === "note") return <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground md:col-span-2">{field.label}</p>;

  const base = formFieldClass;
  const label = <span className="text-sm font-medium text-foreground">{field.label}{field.required ? " *" : ""}</span>;
  const name = `custom:${field.id}`;

  return (
    <label key={field.id} className={field.type === "textarea" || field.type === "checkboxGroup" ? "md:col-span-2" : ""}>
      {label}
      {field.type === "textarea" ? <textarea name={name} required={field.required} className={`${base} min-h-28`} /> : null}
      {field.type === "select" ? (
        <select name={name} required={field.required} className={base}>
          <option value="">Select...</option>
          {(field.options ?? []).map((option) => <option key={option}>{option}</option>)}
        </select>
      ) : null}
      {field.type === "radio" ? (
        <div className="mt-2 grid gap-2">
          {(field.options ?? []).map((option) => <label key={option} className="flex items-center gap-2 text-sm"><input type="radio" name={name} value={option} required={field.required} /> {option}</label>)}
        </div>
      ) : null}
      {field.type === "checkboxGroup" ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(field.options ?? []).map((option) => <label key={option} className="flex items-center gap-2 text-sm"><input type="checkbox" name={name} value={option} /> {option}</label>)}
        </div>
      ) : null}
      {field.type === "number" ? <input name={name} type="number" required={field.required} className={base} /> : null}
      {field.type === "text" ? <input name={name} required={field.required} className={base} /> : null}
      {field.helpText ? <span className="mt-1 block text-xs text-muted-foreground">{field.helpText}</span> : null}
    </label>
  );
}

export function BookingWizard() {
  const tenant = useQuery(api.tenants.getBySlug, { slug: TENANT_SLUG });
  const roomTypes = useQuery(api.tenants.listRoomTypes, { tenantSlug: TENANT_SLUG });
  const formConfig = useQuery(api.tenants.getFormConfig, { tenantSlug: TENANT_SLUG });
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const createRequest = useMutation(api.bookings.createRequest);
  const fields = formConfig?.fields ?? [];
  const [status, setStatus] = useState("");
  const [trackingId, setTrackingId] = useState<string | null>(null);

  const maxUploadMb = useMemo(() => Math.round((tenant?.uploadMaxBytes ?? 104857600) / 1024 / 1024), [tenant?.uploadMaxBytes]);

  async function uploadFiles(files: FileList | null) {
    if (!tenant || !files || files.length === 0 || !formConfig?.fileUploadEnabled) return [];
    const ids: Id<"_storage">[] = [];

    for (const file of Array.from(files)) {
      const url = await generateUploadUrl({ tenantId: tenant._id, sizeBytes: file.size });
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!response.ok) throw new Error(`Failed to upload ${file.name}`);
      const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
      ids.push(storageId);
    }

    return ids;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenant) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const selectedRooms = (roomTypes ?? [])
      .map((room) => ({ roomTypeId: room._id, quantity: Number(data.get(`room:${room._id}`) ?? 0) }))
      .filter((item) => item.quantity > 0);

    if (selectedRooms.length === 0) {
      setStatus("Select at least one room type.");
      return;
    }

    const date = value(form, "date");
    const setupStart = value(form, "setupStart");
    const sessionStart = value(form, "sessionStart");
    const sessionEnd = value(form, "sessionEnd");
    const cleanupEnd = value(form, "cleanupEnd");
    const customInputs = fields
      .filter((field) => field.type !== "divider" && field.type !== "note")
      .map((field) => ({
        fieldId: field.id,
        label: field.label,
        value: field.type === "checkboxGroup" ? data.getAll(`custom:${field.id}`).map(String) : data.get(`custom:${field.id}`),
      }));

    setStatus("Submitting request...");
    const attachmentInput = form.elements.namedItem("attachments") as HTMLInputElement | null;
    const attachmentStorageIds = await uploadFiles(attachmentInput?.files ?? null);
    const requestId = await createRequest({
      tenantId: tenant._id,
      requesterName: value(form, "requesterName"),
      requesterEmail: value(form, "requesterEmail"),
      requesterPhone: value(form, "requesterPhone") || undefined,
      sessionName: value(form, "sessionName"),
      attendeeCount: Number(value(form, "attendeeCount") || 0),
      details: value(form, "details"),
      ccEmails: emails(value(form, "ccEmails")),
      timezone: tenant.timezone,
      blocks: [
        { label: "Setup", start: iso(date, setupStart), end: iso(date, sessionStart) },
        { label: "Session", start: iso(date, sessionStart), end: iso(date, sessionEnd) },
        { label: "Cleanup", start: iso(date, sessionEnd), end: iso(date, cleanupEnd) },
      ],
      roomTypeRequests: selectedRooms,
      customInputs,
      attachmentStorageIds,
    });

    setTrackingId(requestId);
    setStatus("Request submitted.");
    form.reset();
  }

  return (
    <>
      <SectionHeader eyebrow="Request wizard" title="Book a Room" />
      <form onSubmit={onSubmit} className="grid gap-5">
        <Card>
          <h2 className="font-semibold text-foreground">1. Select room types and quantities</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(roomTypes ?? []).map((room) => (
              <label key={room._id} className="rounded-xl border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{room.name}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {room.maxBookingDurationMinutes ? `Max ${formatBookingDuration(room.maxBookingDurationMinutes)}` : "No max duration"}
                  {room.specialRoom ? " · special type" : ""}
                </p>
              </label>
            ))}
          </div>
          {roomTypes?.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">No room types configured yet.</p> : null}
        </Card>
        <Card>
          <h2 className="font-semibold text-foreground">2. Choose date, time, and booking blocks</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <label className="text-sm font-medium text-foreground">Date<input name="date" type="date" required className={formFieldClass} /></label>
            <label className="text-sm font-medium text-foreground">Setup start<input name="setupStart" type="time" required className={formFieldClass} /></label>
            <label className="text-sm font-medium text-foreground">Session start<input name="sessionStart" type="time" required className={formFieldClass} /></label>
            <label className="text-sm font-medium text-foreground">Session end<input name="sessionEnd" type="time" required className={formFieldClass} /></label>
            <label className="text-sm font-medium text-foreground">Cleanup end<input name="cleanupEnd" type="time" required className={formFieldClass} /></label>
          </div>
        </Card>
        <Card>
          <h2 className="font-semibold text-foreground">3. Requester info and booking details</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label><span className="text-sm font-medium text-foreground">Name *</span><input name="requesterName" required className={formFieldClass} /></label>
            <label><span className="text-sm font-medium text-foreground">Email *</span><input name="requesterEmail" type="email" required className={formFieldClass} /></label>
            <label><span className="text-sm font-medium text-foreground">Phone</span><input name="requesterPhone" className={formFieldClass} /></label>
            <label><span className="text-sm font-medium text-foreground">Session name *</span><input name="sessionName" required className={formFieldClass} /></label>
            <label><span className="text-sm font-medium text-foreground">Attendees *</span><input name="attendeeCount" type="number" min="0" required className={formFieldClass} /></label>
            <label><span className="text-sm font-medium text-foreground">CC emails</span><input name="ccEmails" className={formFieldClass} /></label>
            <label className="md:col-span-2"><span className="text-sm font-medium text-foreground">Details *</span><textarea name="details" required className={`${formFieldClass} min-h-28`} /></label>
            {fields.map((field) => renderCustomField(field))}
          </div>
          {formConfig?.fileUploadEnabled ? (
            <label className="mt-4 block rounded-xl border border-dashed border-border p-4">
              <Upload className="size-5 text-primary" />
              <span className="mt-2 block text-sm text-foreground">Optional file upload. Max size: {maxUploadMb} MB.</span>
              <input name="attachments" type="file" multiple className="mt-3 block text-sm" />
            </label>
          ) : null}
        </Card>
        <Card>
          <h2 className="font-semibold text-foreground">4. Submit and track</h2>
          <p className="mt-1 text-sm text-muted-foreground">Submission creates a Pending request and notifies staff.</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button className={primaryButtonClass}>Submit request</button>
            <Link href="/calendar" className={subtleButtonClass}>Back to calendar</Link>
            {status ? <span className="text-sm text-muted-foreground">{status}</span> : null}
            {trackingId ? <Link href={`/requests/${trackingId}`} className="text-sm font-semibold text-primary">View tracking page</Link> : null}
          </div>
        </Card>
      </form>
    </>
  );
}
