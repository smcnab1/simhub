"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Clock, DoorOpen, Info, LoaderCircle, Search, Upload, Users } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Card, SectionHeader, formFieldClass, primaryButtonClass, subtleButtonClass } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { zonedDateTimeToIso } from "@/lib/date-time";
import { formatBlockTime } from "@/lib/format";
import {
  bookingBlocksFromSessionWindow,
  formatBookingDuration,
  roomTypeBufferMinutes,
  validateBookingBlocks,
  validateBookingWithinStaffHours,
  validateRoomSelectionState,
  validateSessionWithinOpeningHours,
  type BookingBlock,
  type RoomSelectionMode,
  type RoomTypeRequest,
} from "@/lib/booking-logic";
import { TENANT_SLUG } from "@/lib/config";

function value(form: HTMLFormElement, name: string) {
  return String(new FormData(form).get(name) ?? "").trim();
}

function emails(input: string) {
  return input.split(",").map((item) => item.trim()).filter(Boolean);
}

type BookingTimeInputs = {
  date: string;
  sessionStart: string;
  sessionEnd: string;
};

function completeTimeInputs(inputs: BookingTimeInputs) {
  return Object.values(inputs).every(Boolean);
}

function severityLabel(severity: string) {
  return severity === "likely_unavailable"
    ? "Likely unavailable"
    : severity === "warning"
      ? "Warning"
      : "Informational";
}

function severityClass(severity: string) {
  if (severity === "likely_unavailable") {
    return "border-destructive/35 bg-destructive/10 text-destructive";
  }

  if (severity === "warning") {
    return "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200";
  }

  return "border-primary/30 bg-primary/10 text-primary";
}

function renderCustomField(field: {
  id: string;
  label: string;
  type: string;
  required: boolean;
  helpText?: string;
  options?: string[];
  maxLength?: number;
}) {
  if (field.type === "divider") return <hr className="my-2 border-border md:col-span-2" />;
  if (field.type === "note") return <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground md:col-span-2">{field.label}</p>;

  const label = <span>{field.label}{field.required ? " *" : ""}</span>;
  const name = `custom:${field.id}`;

  return (
    <div key={field.id} className={field.type === "textarea" || field.type === "checkboxGroup" ? "md:col-span-2" : ""}>
      <Label htmlFor={name} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      {field.type === "textarea" ? (
        <Textarea
          id={name}
          name={name}
          required={field.required}
          maxLength={field.maxLength}
          className="mt-2 min-h-28"
        />
      ) : null}
      {field.type === "select" ? (
        <Select name={name} required={field.required}>
          <SelectTrigger id={name} className="mt-2 w-full">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {field.type === "radio" ? (
        <RadioGroup name={name} required={field.required} className="mt-2">
          {(field.options ?? []).map((option) => (
            <Label key={option} className="flex items-center gap-2 text-sm font-normal">
              <RadioGroupItem value={option} />
              {option}
            </Label>
          ))}
        </RadioGroup>
      ) : null}
      {field.type === "checkboxGroup" ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(field.options ?? []).map((option) => (
            <Label key={option} className="flex items-center gap-2 text-sm font-normal">
              <Checkbox name={name} value={option} />
              {option}
            </Label>
          ))}
        </div>
      ) : null}
      {field.type === "number" ? (
        <Input id={name} name={name} type="number" required={field.required} className="mt-2" />
      ) : null}
      {field.type === "text" ? (
        <Input
          id={name}
          name={name}
          required={field.required}
          maxLength={field.maxLength}
          className="mt-2"
        />
      ) : null}
      {field.helpText ? <span className="mt-1 block text-xs text-muted-foreground">{field.helpText}</span> : null}
    </div>
  );
}

export function BookingWizard() {
  const tenant = useQuery(api.tenants.getBySlug, { slug: TENANT_SLUG });
  const campuses = useQuery(api.tenants.listCampuses, { tenantSlug: TENANT_SLUG });
  const formConfig = useQuery(api.tenants.getFormConfig, { tenantSlug: TENANT_SLUG });
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const createRequest = useMutation(api.bookings.createRequest);
  const fields = formConfig?.fields ?? [];
  const [status, setStatus] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [campusId, setCampusId] = useState<Id<"campuses"> | "">("");
  const [roomSelectionMode, setRoomSelectionMode] = useState<RoomSelectionMode>("RoomTypeQuantity");
  const [requestedRoomIds, setRequestedRoomIds] = useState<Id<"rooms">[]>([]);
  const [roomSearch, setRoomSearch] = useState("");
  const [selectionTouched, setSelectionTouched] = useState(false);
  const [timeInputs, setTimeInputs] = useState<BookingTimeInputs>({
    date: "",
    sessionStart: "",
    sessionEnd: "",
  });
  const [roomQuantities, setRoomQuantities] = useState<Record<string, number>>({});
  const roomTypes = useQuery(api.tenants.listRoomTypes, { tenantSlug: TENANT_SLUG, campusId: campusId || undefined });
  const rooms = useQuery(api.tenants.listRooms, { tenantSlug: TENANT_SLUG, campusId: campusId || undefined });

  const maxUploadMb = useMemo(() => Math.round((tenant?.uploadMaxBytes ?? 104857600) / 1024 / 1024), [tenant?.uploadMaxBytes]);
  const selectedRoomTypeRequests = useMemo(
    () =>
      (roomTypes ?? [])
        .map((room) => ({
          roomTypeId: room._id,
          quantity: roomQuantities[room._id] ?? 0,
        }))
        .filter((item) => item.quantity > 0),
    [roomQuantities, roomTypes]
  );
  const selectedSpecificRooms = useMemo(
    () => (rooms ?? []).filter((room) => requestedRoomIds.includes(room._id)),
    [requestedRoomIds, rooms]
  );
  const bufferRoomTypeRequests = useMemo<RoomTypeRequest[]>(
    () =>
      roomSelectionMode === "SpecificRooms"
        ? Object.entries(
            selectedSpecificRooms.reduce<Record<string, number>>((counts, room) => {
              counts[room.roomTypeId] = (counts[room.roomTypeId] ?? 0) + 1;
              return counts;
            }, {})
          ).map(([roomTypeId, quantity]) => ({ roomTypeId, quantity }))
        : selectedRoomTypeRequests,
    [roomSelectionMode, selectedRoomTypeRequests, selectedSpecificRooms]
  );
  const selectedBuffers = useMemo(
    () =>
      roomTypeBufferMinutes(
        bufferRoomTypeRequests,
        (roomTypes ?? []).map((roomType) => ({
          id: roomType._id,
          name: roomType.name,
          standardSetupMinutes: roomType.standardSetupMinutes,
          standardCleanupMinutes: roomType.standardCleanupMinutes,
        }))
      ),
    [bufferRoomTypeRequests, roomTypes]
  );
  const roomTypeRequestCapacity = useMemo(
    () =>
      selectedRoomTypeRequests.reduce((total, request) => {
        const roomType = roomTypes?.find((type) => type._id === request.roomTypeId);
        return total + (roomType?.defaultCapacity ?? 0) * request.quantity;
      }, 0),
    [roomTypes, selectedRoomTypeRequests]
  );
  const specificRoomCapacity = useMemo(
    () => selectedSpecificRooms.reduce((total, room) => total + room.capacity, 0),
    [selectedSpecificRooms]
  );
  const filteredRooms = useMemo(() => {
    const query = roomSearch.trim().toLowerCase();

    return (rooms ?? []).filter((room) => {
      if (!query) return true;

      return [
        room.code,
        room.name,
        room.roomType?.name,
        room.campus?.name,
      ].some((part) => part?.toLowerCase().includes(query));
    });
  }, [roomSearch, rooms]);
  const selectionError = useMemo(
    () =>
      validateRoomSelectionState(
        roomSelectionMode === "SpecificRooms"
          ? {
              roomSelectionMode,
              requestedRoomIds,
              roomTypeRequests: [],
            }
          : {
              roomSelectionMode,
              requestedRoomIds: [],
              roomTypeRequests: selectedRoomTypeRequests,
            }
      ),
    [requestedRoomIds, roomSelectionMode, selectedRoomTypeRequests]
  );
  const quantityAvailabilityError = useMemo(() => {
    if (roomSelectionMode !== "RoomTypeQuantity") return null;

    const impossibleRequest = selectedRoomTypeRequests.find((request) => {
      const roomType = roomTypes?.find((type) => type._id === request.roomTypeId);
      return roomType && request.quantity > roomType.activeRoomCount;
    });

    if (!impossibleRequest) return null;

    const roomType = roomTypes?.find((type) => type._id === impossibleRequest.roomTypeId);
    return `${roomType?.name ?? "Selected room type"} only has ${roomType?.activeRoomCount ?? 0} active room(s).`;
  }, [roomSelectionMode, roomTypes, selectedRoomTypeRequests]);
  const roomSelectionError = selectionError ?? quantityAvailabilityError;
  const bookingBlocks = useMemo<BookingBlock[] | null>(
    () =>
      completeTimeInputs(timeInputs)
        ? bookingBlocksFromSessionWindow(
            zonedDateTimeToIso(
              timeInputs.date,
              timeInputs.sessionStart,
              tenant?.timezone ?? "Europe/London"
            ),
            zonedDateTimeToIso(
              timeInputs.date,
              timeInputs.sessionEnd,
              tenant?.timezone ?? "Europe/London"
            ),
            selectedBuffers
          )
        : null,
    [selectedBuffers, tenant?.timezone, timeInputs]
  );
  const timeError = useMemo(
    () => {
      if (!bookingBlocks) return null;

      return (
        validateBookingBlocks(bookingBlocks) ??
        validateSessionWithinOpeningHours(
          bookingBlocks.find((block) => block.label === "Session") ?? bookingBlocks[1],
          tenant?.hoursOfOperation ?? "",
          tenant?.timezone ?? "UTC"
        ) ??
        validateBookingWithinStaffHours(
          { start: bookingBlocks[0].start, end: bookingBlocks[bookingBlocks.length - 1].end },
          tenant?.hoursOfOperation ?? "",
          tenant?.timezone ?? "UTC"
        )
      );
    },
    [bookingBlocks, tenant?.hoursOfOperation, tenant?.timezone]
  );
  const availabilityRequest = useMemo(
    () =>
      bookingBlocks && !roomSelectionError && !timeError
        ? {
            tenantSlug: TENANT_SLUG,
            roomSelectionMode,
            blocks: bookingBlocks
              .filter((block) => block.label === "Session")
              .map((block) => ({ start: block.start, end: block.end })),
            requestedRoomIds:
              roomSelectionMode === "SpecificRooms"
                ? requestedRoomIds
                : undefined,
            roomTypeRequests:
              roomSelectionMode === "RoomTypeQuantity"
                ? selectedRoomTypeRequests
                : [],
          }
        : null,
    [bookingBlocks, requestedRoomIds, roomSelectionError, roomSelectionMode, selectedRoomTypeRequests, timeError]
  );
  const availabilityRequestKey = useMemo(
    () => (availabilityRequest ? JSON.stringify(availabilityRequest) : ""),
    [availabilityRequest]
  );
  const [debouncedAvailabilityRequestKey, setDebouncedAvailabilityRequestKey] =
    useState("");
  const debouncedAvailabilityRequest = useMemo(
    () =>
      debouncedAvailabilityRequestKey
        ? (JSON.parse(debouncedAvailabilityRequestKey) as NonNullable<typeof availabilityRequest>)
        : null,
    [debouncedAvailabilityRequestKey]
  );
  const availability = useQuery(
    api.bookings.checkRequestAvailability,
    debouncedAvailabilityRequest ?? "skip"
  );
  const checkingAvailability =
    availabilityRequest !== null &&
    (availability === undefined ||
      availabilityRequestKey !== debouncedAvailabilityRequestKey);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedAvailabilityRequestKey(availabilityRequestKey);
    }, availabilityRequestKey ? 400 : 0);

    return () => window.clearTimeout(timeout);
  }, [availabilityRequestKey]);

  async function uploadFiles(files: FileList | null) {
    if (!tenant || !files || files.length === 0 || !formConfig?.fileUploadEnabled) return [];
    const ids: Id<"_storage">[] = [];

    for (const file of Array.from(files)) {
      const url = await generateUploadUrl({ tenantSlug: TENANT_SLUG, sizeBytes: file.size });
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
    setFormError("");

    if (roomSelectionError) {
      setSelectionTouched(true);
      setFormError(roomSelectionError);
      return;
    }

    if (!bookingBlocks) {
      setFormError("Complete all setup, session, and cleanup times.");
      return;
    }

    if (timeError) {
      setFormError(timeError);
      return;
    }

    if (availability && !availability.canSubmit) {
      setFormError(availability.conflicts[0]?.message ?? availability.summary);
      return;
    }

    const customInputs = fields
      .filter((field) => field.type !== "divider" && field.type !== "note")
      .map((field) => ({
        fieldId: field.id,
        label: field.label,
        value: field.type === "checkboxGroup" ? data.getAll(`custom:${field.id}`).map(String) : data.get(`custom:${field.id}`),
      }));

    setSubmitting(true);
    setStatus("Submitting request...");

    try {
      const attachmentInput = form.elements.namedItem("attachments") as HTMLInputElement | null;
      const attachmentStorageIds = await uploadFiles(attachmentInput?.files ?? null);
      const requesterEmail = value(form, "requesterEmail");
      const requestId = await createRequest({
        tenantSlug: TENANT_SLUG,
        requesterName: value(form, "requesterName"),
        requesterEmail,
        requesterPhone: value(form, "requesterPhone") || undefined,
        sessionName: value(form, "sessionName"),
        attendeeCount: Number(value(form, "attendeeCount") || 0),
        details: value(form, "details"),
        ccEmails: emails(value(form, "ccEmails")),
        timezone: tenant.timezone,
        blocks: bookingBlocks,
        roomSelectionMode,
        requestedRoomIds:
          roomSelectionMode === "SpecificRooms" ? requestedRoomIds : undefined,
        roomTypeRequests:
          roomSelectionMode === "RoomTypeQuantity" ? selectedRoomTypeRequests : [],
        customInputs,
        attachmentStorageIds,
      });

      setTrackingId(requestId);
      setStatus("Request submitted.");
      window.location.href = `/requests/${requestId}?email=${encodeURIComponent(requesterEmail)}`;
      form.reset();
      setRoomQuantities({});
      setRequestedRoomIds([]);
      setRoomSearch("");
      setSelectionTouched(false);
      setCampusId("");
      setTimeInputs({
        date: "",
        sessionStart: "",
        sessionEnd: "",
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not submit request.");
      setStatus("");
    } finally {
      setSubmitting(false);
    }
  }

  function setRoomQuantity(roomTypeId: string, rawValue: string) {
    setSelectionTouched(true);
    setRoomQuantities((current) => ({
      ...current,
      [roomTypeId]: Math.max(0, Number(rawValue) || 0),
    }));
  }

  function setTimeInput(name: keyof BookingTimeInputs, rawValue: string) {
    setTimeInputs((current) => ({ ...current, [name]: rawValue }));
  }

  function setSelectionMode(mode: RoomSelectionMode) {
    setSelectionTouched(true);
    setRoomSelectionMode(mode);
    setStatus("");
  }

  function setCampusFilter(rawCampusId: string) {
    setCampusId(rawCampusId as Id<"campuses"> | "");
    setRequestedRoomIds([]);
    setRoomQuantities({});
  }

  function toggleRequestedRoom(roomId: Id<"rooms">) {
    setSelectionTouched(true);
    setRequestedRoomIds((current) =>
      current.includes(roomId)
        ? current.filter((id) => id !== roomId)
        : [...current, roomId]
    );
  }

  return (
    <>
      <SectionHeader eyebrow="Request wizard" title="Book a Room" />
      <form onSubmit={onSubmit} className="grid gap-5">
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-semibold text-foreground">1. Choose rooms</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Select exact rooms or request a room type and quantity for admin allocation.
              </p>
            </div>
            <div className="grid grid-cols-2 rounded-lg border border-border bg-muted/40 p-1 text-sm">
              {(["SpecificRooms", "RoomTypeQuantity"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSelectionMode(mode)}
                  className={`rounded-md px-3 py-2 font-medium transition ${
                    roomSelectionMode === mode
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {mode === "SpecificRooms" ? "Specific Rooms" : "Room Type Quantity"}
                </button>
              ))}
            </div>
          </div>
          <label className="mt-4 block text-sm font-medium text-foreground">
            Campus/site
            <select
              value={campusId}
              onChange={(event) => setCampusFilter(event.currentTarget.value)}
              className={formFieldClass}
            >
              <option value="">All campuses</option>
              {(campuses ?? []).map((campus) => (
                <option key={campus._id} value={campus._id}>{campus.name}</option>
              ))}
            </select>
          </label>

          {roomSelectionMode === "SpecificRooms" ? (
            <div className="mt-4 grid gap-3">
              <label className="relative block">
                <span className="sr-only">Search rooms</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={roomSearch}
                  onInput={(event) => setRoomSearch(event.currentTarget.value)}
                  onChange={(event) => setRoomSearch(event.currentTarget.value)}
                  placeholder="Search by room code, name, type, or campus"
                  className={`${formFieldClass} mt-0 pl-9`}
                />
              </label>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredRooms.map((room) => {
                  const selected = requestedRoomIds.includes(room._id);

                  return (
                    <button
                      key={room._id}
                      type="button"
                      onClick={() => toggleRequestedRoom(room._id)}
                      className={`rounded-xl border p-3 text-left transition hover:border-ring ${
                        selected
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-card text-foreground"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">{room.name}</p>
                          <p className="mt-1 font-mono text-xs text-muted-foreground">{room.code}</p>
                        </div>
                        <span className={`grid size-6 shrink-0 place-items-center rounded-full border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                          {selected ? <Check className="size-3.5" /> : <DoorOpen className="size-3.5 text-muted-foreground" />}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {room.roomType?.name ? <Badge variant="outline">{room.roomType.name}</Badge> : null}
                        {room.campus?.name ? <Badge variant="outline">{room.campus.name}</Badge> : null}
                        <Badge variant="outline" className="gap-1">
                          <Users className="size-3" /> {room.capacity}
                        </Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
              {filteredRooms.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                  No active rooms match your search.
                </p>
              ) : null}
              <p className="rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground">
                {selectedSpecificRooms.length
                  ? `Selected rooms support ~${specificRoomCapacity} people total.`
                  : "Select one or more active rooms to see combined capacity."}
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(roomTypes ?? []).map((roomType) => {
                const quantity = roomQuantities[roomType._id] ?? 0;

                return (
                  <label key={roomType._id} className="rounded-xl border border-border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{roomType.name}</p>
                        {roomType.description ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{roomType.description}</p> : null}
                      </div>
                      <input
                        name={`room:${roomType._id}`}
                        type="number"
                        min="0"
                        max={roomType.activeRoomCount}
                        step="1"
                        inputMode="numeric"
                        value={quantity}
                        onInput={(event) => setRoomQuantity(roomType._id, event.currentTarget.value)}
                        onChange={(event) => setRoomQuantity(roomType._id, event.currentTarget.value)}
                        className="h-10 w-20 rounded-lg border border-input bg-background px-3 text-right text-sm font-medium text-foreground shadow-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {roomType.campus?.name ? <Badge variant="outline">{roomType.campus.name}</Badge> : null}
                      <Badge variant="outline">{roomType.activeRoomCount} active</Badge>
                      <Badge variant="outline" className="gap-1">
                        <Users className="size-3" /> ~{roomType.defaultCapacity} each
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <Clock className="size-3" /> {roomType.standardSetupMinutes ?? 30}+{roomType.standardCleanupMinutes ?? 30} min
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {quantity > 0
                        ? `${quantity} ${roomType.name}${quantity === 1 ? "" : "s"} typically support ~${quantity * roomType.defaultCapacity} people.`
                        : roomType.maxBookingDurationMinutes
                          ? `Max ${formatBookingDuration(roomType.maxBookingDurationMinutes)}`
                          : "No max duration"}
                      {roomType.specialRoom ? " · special type" : ""}
                    </p>
                  </label>
                );
              })}
              {roomTypes?.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                  No room types configured yet.
                </p>
              ) : null}
              {selectedRoomTypeRequests.length ? (
                <p className="rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
                  Selected room type quantities typically support ~{roomTypeRequestCapacity} people.
                </p>
              ) : null}
            </div>
          )}
          {roomSelectionError && selectionTouched ? <p className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{roomSelectionError}</p> : null}
        </Card>
        <Card>
          <h2 className="font-semibold text-foreground">2. Choose date and session time</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Setup and cleanup are added automatically from room type standards: {selectedBuffers.setupMinutes} min setup and {selectedBuffers.cleanupMinutes} min cleanup.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="text-sm font-medium text-foreground">Date<input name="date" type="date" required value={timeInputs.date} onInput={(event) => setTimeInput("date", event.currentTarget.value)} onChange={(event) => setTimeInput("date", event.currentTarget.value)} className={formFieldClass} /></label>
            <label className="text-sm font-medium text-foreground">Session start<input name="sessionStart" type="time" required value={timeInputs.sessionStart} onInput={(event) => setTimeInput("sessionStart", event.currentTarget.value)} onChange={(event) => setTimeInput("sessionStart", event.currentTarget.value)} className={formFieldClass} /></label>
            <label className="text-sm font-medium text-foreground">Session finish<input name="sessionEnd" type="time" required value={timeInputs.sessionEnd} onInput={(event) => setTimeInput("sessionEnd", event.currentTarget.value)} onChange={(event) => setTimeInput("sessionEnd", event.currentTarget.value)} className={formFieldClass} /></label>
          </div>
          {timeError ? <p className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{timeError}</p> : null}
          {bookingBlocks && !timeError ? (
            <div className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
              {bookingBlocks.map((block) => (
                <p key={block.label} className="rounded-xl bg-muted/40 p-3">
                  <span className="font-medium text-foreground">{block.label}</span>: {formatBlockTime(block, tenant?.timezone)}
                </p>
              ))}
            </div>
          ) : null}
        </Card>
        <Card className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-foreground">Availability review</h2>
            {checkingAvailability ? (
              <Badge variant="outline" className="gap-1.5">
                <LoaderCircle className="size-3 animate-spin" /> Checking
              </Badge>
            ) : availability?.highestSeverity ? (
              <Badge variant="outline" className={severityClass(availability.highestSeverity)}>
                {severityLabel(availability.highestSeverity)}
              </Badge>
            ) : availability ? (
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">No conflicts</Badge>
            ) : (
              <Badge variant="outline">Waiting for details</Badge>
            )}
          </div>
          {availability?.conflicts.length ? (
            <div className="grid gap-2">
              {availability.conflicts.map((conflict, index) => (
                <div key={`${conflict.type}-${index}`} className={`rounded-xl border p-3 text-sm ${severityClass(conflict.severity)}`}>
                  <div className="flex items-start gap-2">
                    {conflict.severity === "informational" ? <Info className="mt-0.5 size-4 shrink-0" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" />}
                    <div>
                      <p className="font-medium">{conflict.message}</p>
                      {conflict.severity === "likely_unavailable" ? <p className="mt-1">This request may not be possible and will require admin review.</p> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              {availability ? availability.summary : "Complete the room, date, and time details to check availability before submitting."}
            </p>
          )}
        </Card>
        <Card>
          <h2 className="font-semibold text-foreground">3. Requester info and booking details</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label><span className="text-sm font-medium text-foreground">Name *</span><input name="requesterName" required className={formFieldClass} /></label>
            <label><span className="text-sm font-medium text-foreground">Email *</span><input name="requesterEmail" type="email" required className={formFieldClass} /></label>
            <label><span className="text-sm font-medium text-foreground">Phone</span><input name="requesterPhone" className={formFieldClass} /></label>
            <label><span className="text-sm font-medium text-foreground">Session name *</span><input name="sessionName" required className={formFieldClass} /></label>
            <label><span className="text-sm font-medium text-foreground">Attendees *</span><input name="attendeeCount" type="number" min="1" required className={formFieldClass} /></label>
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
          <h2 className="font-semibold text-foreground">4. Review, submit, and track</h2>
          <div className="mt-3 grid gap-2 rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            <p>
              Room request: <span className="font-medium text-foreground">
                {roomSelectionMode === "SpecificRooms"
                  ? `${selectedSpecificRooms.length} specific room${selectedSpecificRooms.length === 1 ? "" : "s"}`
                  : `${selectedRoomTypeRequests.reduce((total, request) => total + request.quantity, 0)} room${selectedRoomTypeRequests.reduce((total, request) => total + request.quantity, 0) === 1 ? "" : "s"} by type`}
              </span>
            </p>
            <p>
              Occupied window: <span className="font-medium text-foreground">
                {bookingBlocks ? formatBlockTime({ start: bookingBlocks[0].start, end: bookingBlocks[2].end }, tenant?.timezone) : "Complete date and session times to preview"}
              </span>
            </p>
            <p>
              Availability: <span className="font-medium text-foreground">
                {availability?.summary ?? "Availability will be checked before submission."}
              </span>
            </p>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Submission creates a Pending request and notifies staff. You can track it with the booking reference and requester email.</p>
          {formError ? <p className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{formError}</p> : null}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button disabled={submitting} className={primaryButtonClass}>
              {submitting ? "Submitting..." : "Submit request"}
            </button>
            <Link href="/calendar" className={subtleButtonClass}>Back to calendar</Link>
            {status ? <span className="text-sm text-muted-foreground">{status}</span> : null}
            {trackingId ? <Link href={`/requests/${trackingId}`} className="text-sm font-semibold text-primary">View tracking page</Link> : null}
          </div>
        </Card>
      </form>
    </>
  );
}
