"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useDashboardAuth } from "@/components/dashboard-auth";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import {
  AdminSettingsCard,
  AdminSettingsRow,
} from "@/components/admin/admin-settings-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Building2Icon,
  BellIcon,
  ClockIcon,
  HardDriveIcon,
  SaveIcon,
  AlertCircleIcon,
  CalendarClockIcon,
  ImageIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { toast } from "sonner";

function parseEmails(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function validateHours(hours: WeekHours) {
  for (const day of DAYS) {
    const value = hours[day];

    if (value.closed) continue;

    if (
      !value.publicOpen ||
      !value.publicClose ||
      !value.staffOpen ||
      !value.staffClose
    ) {
      return `${day} hours must include all opening and closing times.`;
    }

    if (value.publicOpen >= value.publicClose) {
      return `${day} public opening time must be before closing time.`;
    }

    if (value.staffOpen >= value.staffClose) {
      return `${day} staff opening time must be before closing time.`;
    }

    if (value.staffOpen > value.publicOpen || value.staffClose < value.publicClose) {
      return `${day} staff hours must cover the full public booking window.`;
    }
  }

  return null;
}

function FieldSkeleton() {
  return <Skeleton className="h-9 w-full rounded-lg" />;
}

// Days of the week
const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

type DayName = (typeof DAYS)[number];

interface DayHours {
  publicOpen: string;
  publicClose: string;
  staffOpen: string;
  staffClose: string;
  closed: boolean;
}

type WeekHours = Record<DayName, DayHours>;

const DEFAULT_HOURS: WeekHours = {
  Monday: { publicOpen: "09:00", publicClose: "17:00", staffOpen: "08:30", staffClose: "17:30", closed: false },
  Tuesday: { publicOpen: "09:00", publicClose: "17:00", staffOpen: "08:30", staffClose: "17:30", closed: false },
  Wednesday: { publicOpen: "09:00", publicClose: "17:00", staffOpen: "08:30", staffClose: "17:30", closed: false },
  Thursday: { publicOpen: "09:00", publicClose: "17:00", staffOpen: "08:30", staffClose: "17:30", closed: false },
  Friday: { publicOpen: "09:00", publicClose: "17:00", staffOpen: "08:30", staffClose: "17:30", closed: false },
  Saturday: { publicOpen: "09:00", publicClose: "17:00", staffOpen: "08:30", staffClose: "17:30", closed: true },
  Sunday: { publicOpen: "09:00", publicClose: "17:00", staffOpen: "08:30", staffClose: "17:30", closed: true },
};

// Serialize week hours to a string for storage
function serializeHours(hours: WeekHours): string {
  const lines: string[] = [];
  for (const day of DAYS) {
    const h = hours[day];
    if (h.closed) {
      lines.push(`${day}: Closed`);
    } else {
      lines.push(`${day}: Public ${h.publicOpen} - ${h.publicClose}; Staff ${h.staffOpen} - ${h.staffClose}`);
    }
  }
  return lines.join("\n");
}

// Parse stored string back to WeekHours
function parseHours(str: string): WeekHours {
  const result = { ...DEFAULT_HOURS };
  if (!str) return result;

  const lines = str.split("\n");
  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      const dayName = match[1] as DayName;
      const value = match[2].trim();
      if (DAYS.includes(dayName)) {
        if (value.toLowerCase() === "closed") {
          result[dayName] = { ...result[dayName], closed: true };
        } else {
          const splitMatch = value.match(/Public\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2});\s*Staff\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/i);
          if (splitMatch) {
            result[dayName] = {
              publicOpen: splitMatch[1],
              publicClose: splitMatch[2],
              staffOpen: splitMatch[3],
              staffClose: splitMatch[4],
              closed: false,
            };
            continue;
          }

          const timeMatch = value.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
          if (timeMatch) {
            result[dayName] = {
              publicOpen: timeMatch[1],
              publicClose: timeMatch[2],
              staffOpen: subtractMinutes(timeMatch[1], 30),
              staffClose: addMinutes(timeMatch[2], 30),
              closed: false,
            };
          }
        }
      }
    }
  }
  return result;
}

function addMinutes(time: string, minutes: number) {
  const [hours, mins] = time.split(":").map(Number);
  const total = Math.max(0, hours * 60 + mins + minutes);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function subtractMinutes(time: string, minutes: number) {
  return addMinutes(time, -minutes);
}

export function FacilityAdmin() {
  const auth = useDashboardAuth();
  const tenantSlug = auth.tenantSlug;
  const tenant = useQuery(api.tenants.getPrivateTenant, { tenantSlug, auth });
  const saveFacility = useMutation(api.tenants.upsertFacilityDetails);
  const generateTenantLogoUploadUrl = useMutation(api.files.generateTenantLogoUploadUrl);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Local form state
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [notificationEmails, setNotificationEmails] = useState("");
  const [notificationEmailsEnabled, setNotificationEmailsEnabled] = useState(true);
  const [weekHours, setWeekHours] = useState<WeekHours>(DEFAULT_HOURS);
  const [uploadMaxMb, setUploadMaxMb] = useState("100");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [minimumAdvanceBookingDays, setMinimumAdvanceBookingDays] = useState("");
  const [maximumAdvanceBookingDays, setMaximumAdvanceBookingDays] = useState("");
  const [bookingNoticeViolationMode, setBookingNoticeViolationMode] =
    useState<"Block" | "Warn">("Block");

  // Initialise local state when tenant loads
  useEffect(() => {
    if (tenant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(tenant.name);
      setContactEmail(tenant.contactEmail);
      setNotificationEmails(tenant.notificationEmails.join(", "));
      setNotificationEmailsEnabled(tenant.notificationEmailsEnabled ?? true);
      setWeekHours(parseHours(tenant.hoursOfOperation));
      setUploadMaxMb(String(Math.round(tenant.uploadMaxBytes / 1024 / 1024)));
      setMinimumAdvanceBookingDays(
        tenant.minimumAdvanceBookingDays === undefined
          ? ""
          : String(tenant.minimumAdvanceBookingDays)
      );
      setMaximumAdvanceBookingDays(
        tenant.maximumAdvanceBookingDays === undefined
          ? ""
          : String(tenant.maximumAdvanceBookingDays)
      );
      setBookingNoticeViolationMode(tenant.bookingNoticeViolationMode ?? "Block");
      setLogoFile(null);
      setRemoveLogo(false);
      setLogoPreviewUrl(tenant.logoUrl ?? null);
      setFormError(null);
      setSuccessMessage(null);
    }
  }, [tenant]);

  useEffect(() => {
    return () => {
      if (logoPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
    };
  }, [logoPreviewUrl]);

  function markDirty() {
    setSuccessMessage(null);
    setHasChanges(true);
  }

  function updateDayHours(day: DayName, field: keyof DayHours, value: string | boolean) {
    setWeekHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
    markDirty();
  }

  function handleLogoChange(file: File | undefined) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setFormError("Logo must be an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFormError("Logo must be 5 MB or smaller.");
      return;
    }

    if (logoPreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(logoPreviewUrl);
    }

    setLogoFile(file);
    setLogoPreviewUrl(URL.createObjectURL(file));
    setRemoveLogo(false);
    setFormError(null);
    markDirty();
  }

  function handleRemoveLogo() {
    if (logoPreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(logoPreviewUrl);
    }

    setLogoFile(null);
    setLogoPreviewUrl(null);
    setRemoveLogo(true);
    markDirty();
  }

  async function uploadLogo() {
    if (!logoFile) return undefined;

    const url = await generateTenantLogoUploadUrl({
      tenantSlug,
      auth,
      sizeBytes: logoFile.size,
    });
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": logoFile.type || "application/octet-stream" },
      body: logoFile,
    });

    if (!response.ok) {
      throw new Error("Failed to upload logo.");
    }

    const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
    return storageId;
  }

  function validateForm() {
    const trimmedName = name.trim();
    const trimmedContactEmail = contactEmail.trim();
    const parsedNotificationEmails = parseEmails(notificationEmails);
    const uploadLimit = Number(uploadMaxMb);
    const minimumDays =
      minimumAdvanceBookingDays.trim() === ""
        ? undefined
        : Number(minimumAdvanceBookingDays);
    const maximumDays =
      maximumAdvanceBookingDays.trim() === ""
        ? undefined
        : Number(maximumAdvanceBookingDays);

    if (!trimmedName) {
      return "Facility name is required.";
    }

    if (!isValidEmail(trimmedContactEmail)) {
      return "Enter a valid contact email address.";
    }

    if (parsedNotificationEmails.some((email) => !isValidEmail(email))) {
      return "Enter valid notification email addresses separated by commas.";
    }

    const hoursError = validateHours(weekHours);
    if (hoursError) {
      return hoursError;
    }

    if (!Number.isInteger(uploadLimit) || uploadLimit < 1 || uploadLimit > 100) {
      return "Upload limit must be a whole number between 1 and 100 MB.";
    }

    if (
      minimumDays !== undefined &&
      (!Number.isInteger(minimumDays) || minimumDays < 0)
    ) {
      return "Minimum advance notice must be a whole number of days.";
    }

    if (
      maximumDays !== undefined &&
      (!Number.isInteger(maximumDays) || maximumDays < 0)
    ) {
      return "Maximum future booking window must be a whole number of days.";
    }

    if (
      minimumDays !== undefined &&
      maximumDays !== undefined &&
      minimumDays > maximumDays
    ) {
      return "Minimum advance notice cannot be greater than the maximum future booking window.";
    }

    return null;
  }

  async function handleSave() {
    if (!tenant) return;
    const validationError = validateForm();

    if (validationError) {
      setFormError(validationError);
      setSuccessMessage(null);
      toast.error(validationError);
      return;
    }

    setSaving(true);
    setFormError(null);
    setSuccessMessage(null);
    try {
      const logoStorageId = await uploadLogo();

      await saveFacility({
        tenantSlug,
        auth,
        name: name.trim(),
        contactEmail: contactEmail.trim(),
        notificationEmails: parseEmails(notificationEmails),
        notificationEmailsEnabled,
        hoursOfOperation: serializeHours(weekHours),
        uploadMaxBytes: Number(uploadMaxMb || 100) * 1024 * 1024,
        minimumAdvanceBookingDays:
          minimumAdvanceBookingDays.trim() === ""
            ? undefined
            : Number(minimumAdvanceBookingDays),
        maximumAdvanceBookingDays:
          maximumAdvanceBookingDays.trim() === ""
            ? undefined
            : Number(maximumAdvanceBookingDays),
        bookingNoticeViolationMode,
        logoStorageId,
        removeLogo: removeLogo && !logoStorageId,
      });
      setHasChanges(false);
      setLogoFile(null);
      setRemoveLogo(false);
      setSuccessMessage("Tenant settings saved.");
      toast.success("Facility settings saved successfully.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to save facility settings. Please try again.";
      setFormError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const isLoading = tenant === undefined;

  return (
    <div className="flex flex-col gap-8 pb-16">
      <AdminPageHeader
        title="Tenant Settings"
        description="Manage the core details, contact routing, hours, branding, and upload limits for this tenant."
        breadcrumbs={[{ label: "Tenant Settings" }]}
        actions={
          <div className="flex items-center gap-3">
            {hasChanges && (
              <span className="flex items-center gap-1.5 text-xs text-primary font-medium">
                <AlertCircleIcon className="size-3.5" />
                Unsaved changes
              </span>
            )}
            <Button
              onClick={handleSave}
              disabled={saving || isLoading || !hasChanges}
              size="sm"
              className="gap-1.5"
            >
              <SaveIcon className="size-3.5" data-icon="inline-start" />
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        }
      />

      {(formError || successMessage) && (
        <div
          className={
            formError
              ? "rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              : "rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary"
          }
          role={formError ? "alert" : "status"}
        >
          {formError ?? successMessage}
        </div>
      )}

      {/* General */}
      <AdminSettingsCard
        title="General"
        description="Your facility's public-facing identity."
        icon={<Building2Icon className="size-4" />}
      >
        <div className="flex flex-col gap-0">
          <AdminSettingsRow
            label="Facility name"
            description="The display name used across the platform and in communications."
          >
            {isLoading ? (
              <FieldSkeleton />
            ) : (
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  markDirty();
                }}
                aria-invalid={!name.trim()}
                placeholder="e.g. London Simulation Centre"
              />
            )}
          </AdminSettingsRow>
        </div>
      </AdminSettingsCard>

      {/* Contact */}
      <AdminSettingsCard
        title="Contact"
        description="Primary contact details and notification routing."
        icon={<BellIcon className="size-4" />}
      >
        <div className="flex flex-col gap-0">
          <AdminSettingsRow
            label="Contact email"
            description="Primary contact address for general enquiries."
          >
            {isLoading ? (
              <FieldSkeleton />
            ) : (
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => {
                  setContactEmail(e.target.value);
                  markDirty();
                }}
                aria-invalid={!!contactEmail.trim() && !isValidEmail(contactEmail)}
                placeholder="admin@example.edu"
              />
            )}
          </AdminSettingsRow>

          <AdminSettingsRow
            label="Notification recipients"
            description="Comma-separated list of email addresses for tenant-level new booking alerts."
            stacked
          >
            {isLoading ? (
              <FieldSkeleton />
            ) : (
              <div className="flex flex-col gap-2">
                <Input
                  value={notificationEmails}
                  onChange={(e) => {
                    setNotificationEmails(e.target.value);
                    markDirty();
                  }}
                  aria-invalid={parseEmails(notificationEmails).some(
                    (email) => !isValidEmail(email)
                  )}
                  placeholder="notifications@example.edu, manager@example.edu"
                />
                <p className="text-xs text-muted-foreground">
                  Separate multiple addresses with commas.
                </p>
              </div>
            )}
          </AdminSettingsRow>

          <AdminSettingsRow
            label="Email notification recipients"
            description="Send new booking request emails to the addresses listed above."
          >
            {isLoading ? (
              <FieldSkeleton />
            ) : (
              <div className="flex items-center gap-3">
                <Switch
                  checked={notificationEmailsEnabled}
                  onCheckedChange={(checked) => {
                    setNotificationEmailsEnabled(checked);
                    markDirty();
                  }}
                />
                <Label className="text-sm text-muted-foreground">
                  {notificationEmailsEnabled ? "Enabled" : "Disabled"}
                </Label>
              </div>
            )}
          </AdminSettingsRow>
        </div>
      </AdminSettingsCard>

      {/* Booking Notice */}
      <AdminSettingsCard
        title="Booking Notice Windows"
        description="Control how close to today or how far into the future requester bookings may be submitted."
        icon={<CalendarClockIcon className="size-4" />}
      >
        <div className="flex flex-col gap-0">
          <AdminSettingsRow
            label="Minimum advance notice"
            description="Requests starting sooner than this many tenant-local calendar days will be flagged."
          >
            {isLoading ? (
              <FieldSkeleton />
            ) : (
              <div className="flex items-center gap-2 max-w-xs">
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={minimumAdvanceBookingDays}
                  onChange={(event) => {
                    setMinimumAdvanceBookingDays(event.currentTarget.value);
                    markDirty();
                  }}
                  placeholder="No minimum"
                  className="w-28"
                />
                <span className="text-sm text-muted-foreground font-medium">days</span>
              </div>
            )}
          </AdminSettingsRow>
          <AdminSettingsRow
            label="Maximum future booking window"
            description="Requests starting after this many tenant-local calendar days will be flagged."
          >
            {isLoading ? (
              <FieldSkeleton />
            ) : (
              <div className="flex items-center gap-2 max-w-xs">
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={maximumAdvanceBookingDays}
                  onChange={(event) => {
                    setMaximumAdvanceBookingDays(event.currentTarget.value);
                    markDirty();
                  }}
                  placeholder="No maximum"
                  className="w-28"
                />
                <span className="text-sm text-muted-foreground font-medium">days</span>
              </div>
            )}
          </AdminSettingsRow>
          <AdminSettingsRow
            label="Violation handling"
            description="Choose whether public/requester submissions outside the window are blocked or allowed as pending with warning."
          >
            {isLoading ? (
              <FieldSkeleton />
            ) : (
              <select
                value={bookingNoticeViolationMode}
                onChange={(event) => {
                  setBookingNoticeViolationMode(event.currentTarget.value as "Block" | "Warn");
                  markDirty();
                }}
                className="h-9 w-full max-w-xs rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
              >
                <option value="Block">Block submission</option>
                <option value="Warn">Allow pending approval with warning</option>
              </select>
            )}
          </AdminSettingsRow>
        </div>
      </AdminSettingsCard>

      {/* Hours */}
      <AdminSettingsCard
        title="Hours"
        description="Configure your facility's operating hours for each day of the week."
        icon={<ClockIcon className="size-4" />}
        noPadding
      >
        <div className="divide-y divide-border">
          {DAYS.map((day) => {
            const hours = weekHours[day];
            return (
              <div
                key={day}
                className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-5 py-4"
              >
                <div className="flex items-center justify-between sm:w-32">
                  <span className="text-sm font-medium text-foreground">{day}</span>
                </div>
                {isLoading ? (
                  <div className="flex-1">
                    <Skeleton className="h-9 w-full max-w-xs" />
                  </div>
                ) : (
                  <div className="flex flex-1 flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={!hours.closed}
                        onCheckedChange={(checked) =>
                          updateDayHours(day, "closed", !checked)
                        }
                      />
                      <Label className="text-sm text-muted-foreground">
                        {hours.closed ? "Closed" : "Open"}
                      </Label>
                    </div>
                    {!hours.closed && (
                      <div className="grid gap-3 lg:grid-cols-2">
                        <div>
                          <p className="mb-1 text-xs font-medium text-muted-foreground">Public booking hours</p>
                          <div className="flex items-center gap-2">
                            <Input
                              type="time"
                              value={hours.publicOpen}
                              onChange={(e) => updateDayHours(day, "publicOpen", e.target.value)}
                              className="w-28"
                            />
                            <span className="text-sm text-muted-foreground">to</span>
                            <Input
                              type="time"
                              value={hours.publicClose}
                              onChange={(e) => updateDayHours(day, "publicClose", e.target.value)}
                              className="w-28"
                            />
                          </div>
                        </div>
                        <div>
                          <p className="mb-1 text-xs font-medium text-muted-foreground">Staff setup/cleanup hours</p>
                          <div className="flex items-center gap-2">
                            <Input
                              type="time"
                              value={hours.staffOpen}
                              onChange={(e) => updateDayHours(day, "staffOpen", e.target.value)}
                              className="w-28"
                            />
                            <span className="text-sm text-muted-foreground">to</span>
                            <Input
                              type="time"
                              value={hours.staffClose}
                              onChange={(e) => updateDayHours(day, "staffClose", e.target.value)}
                              className="w-28"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </AdminSettingsCard>

      {/* Branding */}
      <AdminSettingsCard
        title="Branding"
        description="Display a tenant logo where the product surfaces branding."
        icon={<ImageIcon className="size-4" />}
      >
        <div className="flex flex-col gap-0">
          <AdminSettingsRow
            label="Logo"
            description="Upload a PNG, JPG, SVG, or WebP image up to 5 MB."
            stacked
          >
            {isLoading ? (
              <FieldSkeleton />
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex h-24 w-40 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30">
                    {logoPreviewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logoPreviewUrl}
                        alt={`${name || "Tenant"} logo`}
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <ImageIcon className="size-8 text-muted-foreground" aria-hidden="true" />
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Label
                      htmlFor="tenant-logo"
                      className="inline-flex h-7 cursor-pointer items-center justify-center gap-1 rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium whitespace-nowrap transition-all hover:bg-muted hover:text-foreground focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:border-input dark:bg-input/30 dark:hover:bg-input/50"
                    >
                      <UploadIcon className="size-3.5" data-icon="inline-start" />
                      Upload logo
                    </Label>
                    <Input
                      id="tenant-logo"
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      className="sr-only"
                      onChange={(event) => handleLogoChange(event.currentTarget.files?.[0])}
                    />
                    {logoPreviewUrl ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={handleRemoveLogo}
                      >
                        <Trash2Icon className="size-3.5" data-icon="inline-start" />
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Logo changes are saved when you press Save changes.
                </p>
              </div>
            )}
          </AdminSettingsRow>
        </div>
      </AdminSettingsCard>

      {/* Uploads */}
      <AdminSettingsCard
        title="Uploads"
        description="Control how large uploaded files can be for booking requests."
        icon={<HardDriveIcon className="size-4" />}
        footer={
          <p className="text-xs text-muted-foreground">
            File uploads are stored securely in Convex file storage. Changes take effect on
            the next submission.
          </p>
        }
      >
        <div className="flex flex-col gap-0">
          <AdminSettingsRow
            label="Upload limit (MB)"
            description="Maximum size per attachment on booking requests. Min 1 MB, max 100 MB."
          >
            {isLoading ? (
              <FieldSkeleton />
            ) : (
              <div className="flex items-center gap-2 max-w-xs">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={uploadMaxMb}
                  onChange={(e) => {
                    setUploadMaxMb(e.target.value);
                    markDirty();
                  }}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground font-medium">MB</span>
              </div>
            )}
          </AdminSettingsRow>
        </div>
      </AdminSettingsCard>

      {/* Sticky save bar on mobile */}
      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden border-t border-border bg-background/95 backdrop-blur-sm px-4 py-3 flex items-center justify-between gap-4">
          <span className="text-sm text-muted-foreground">You have unsaved changes</span>
          <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
            <SaveIcon className="size-3.5" data-icon="inline-start" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      )}
    </div>
  );
}
