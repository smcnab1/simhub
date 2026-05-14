"use client";

import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Building2Icon,
  MailIcon,
  BellIcon,
  ClockIcon,
  HardDriveIcon,
  SaveIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function parseEmails(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function FieldSkeleton() {
  return <Skeleton className="h-9 w-full rounded-lg" />;
}

export function FacilityAdmin() {
  const auth = useDashboardAuth();
  const tenantSlug = auth.tenantSlug;
  const tenant = useQuery(api.tenants.getPrivateTenant, { tenantSlug, auth });
  const saveFacility = useMutation(api.tenants.upsertFacilityDetails);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Local form state synced from tenant
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [notificationEmails, setNotificationEmails] = useState("");
  const [hoursOfOperation, setHoursOfOperation] = useState("");
  const [uploadMaxMb, setUploadMaxMb] = useState("100");

  // Initialise local state when tenant loads (only once)
  const [initialised, setInitialised] = useState(false);
  if (tenant && !initialised) {
    setName(tenant.name);
    setContactEmail(tenant.contactEmail);
    setNotificationEmails(tenant.notificationEmails.join(", "));
    setHoursOfOperation(tenant.hoursOfOperation);
    setUploadMaxMb(String(Math.round(tenant.uploadMaxBytes / 1024 / 1024)));
    setInitialised(true);
  }

  function markDirty() {
    setHasChanges(true);
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
        hoursOfOperation: hoursOfOperation.trim(),
        uploadMaxBytes: Number(uploadMaxMb || 100) * 1024 * 1024,
      });
      setHasChanges(false);
      toast.success("Facility settings saved successfully.");
    } catch (err) {
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
              <span className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
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
              {saving ? "Saving…" : "Save changes"}
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

      {/* Operations */}
      <AdminSettingsCard
        title="Operational Settings"
        description="Configure your facility's operating hours and booking constraints."
        icon={<ClockIcon className="size-4" />}
      >
        <div className="flex flex-col gap-0">
          <AdminSettingsRow
            label="Hours of operation"
            description="Displayed to requesters on the public booking form. e.g. Mon–Fri, 08:00–18:00"
          >
            {isLoading ? (
              <FieldSkeleton />
            ) : (
              <Input
                value={hoursOfOperation}
                onChange={(e) => {
                  setHoursOfOperation(e.target.value);
                  markDirty();
                }}
                placeholder="Monday – Friday, 08:00 – 18:00"
              />
            )}
          </AdminSettingsRow>
        </div>
      </AdminSettingsCard>

      {/* Storage */}
      <AdminSettingsCard
        title="File Storage"
        description="Control how large uploaded files can be for booking requests."
        icon={<HardDriveIcon className="size-4" />}
        footer={
          <p className="text-xs text-muted-foreground">
            File uploads are stored securely in Convex file storage. Changes take effect on the next submission.
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
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      )}
    </div>
  );
}
