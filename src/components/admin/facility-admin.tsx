"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
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
} from "lucide-react";
import { toast } from "sonner";

function parseEmails(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Local form state
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [notificationEmails, setNotificationEmails] = useState("");
  const [weekHours, setWeekHours] = useState<WeekHours>(DEFAULT_HOURS);
  const [uploadMaxMb, setUploadMaxMb] = useState("100");

  // Initialise local state when tenant loads
  useEffect(() => {
    if (tenant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(tenant.name);
      setContactEmail(tenant.contactEmail);
      setNotificationEmails(tenant.notificationEmails.join(", "));
      setWeekHours(parseHours(tenant.hoursOfOperation));
      setUploadMaxMb(String(Math.round(tenant.uploadMaxBytes / 1024 / 1024)));
    }
  }, [tenant]);

  function markDirty() {
    setHasChanges(true);
  }

  function updateDayHours(day: DayName, field: keyof DayHours, value: string | boolean) {
    setWeekHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
    markDirty();
  }

  async function handleSave() {
    if (!tenant) return;
    setSaving(true);
    try {
      await saveFacility({
        tenantSlug,
        auth,
        name: name.trim(),
        contactEmail: contactEmail.trim(),
        notificationEmails: parseEmails(notificationEmails),
        hoursOfOperation: serializeHours(weekHours),
        uploadMaxBytes: Number(uploadMaxMb || 100) * 1024 * 1024,
      });
      setHasChanges(false);
      toast.success("Facility settings saved successfully.");
    } catch {
      toast.error("Failed to save facility settings. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const isLoading = tenant === undefined;

  return (
    <div className="flex flex-col gap-8 pb-16">
      <AdminPageHeader
        title="Facility Details"
        description="Manage your facility's core information, contact details, and operational settings."
        breadcrumbs={[{ label: "Facility Details" }]}
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

      {/* Identity */}
      <AdminSettingsCard
        title="Facility Identity"
        description="Your facility's public-facing name and primary contact information."
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
                placeholder="e.g. London Simulation Centre"
              />
            )}
          </AdminSettingsRow>

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
                placeholder="admin@example.edu"
              />
            )}
          </AdminSettingsRow>
        </div>
      </AdminSettingsCard>

      {/* Notifications */}
      <AdminSettingsCard
        title="Notification Emails"
        description="Additional email addresses that receive booking notifications and alerts."
        icon={<BellIcon className="size-4" />}
      >
        <div className="flex flex-col gap-0">
          <AdminSettingsRow
            label="Notification recipients"
            description="Comma-separated list of email addresses. These receive copies of all booking-related notifications."
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
                  placeholder="notifications@example.edu, manager@example.edu"
                />
                <p className="text-xs text-muted-foreground">
                  Separate multiple addresses with commas.
                </p>
              </div>
            )}
          </AdminSettingsRow>
        </div>
      </AdminSettingsCard>

      {/* Opening Hours */}
      <AdminSettingsCard
        title="Opening Hours"
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

      {/* Storage */}
      <AdminSettingsCard
        title="File Storage"
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
