"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useDashboardAuth } from "@/components/dashboard-auth";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSettingsCard } from "@/components/admin/admin-settings-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  FormInputIcon,
  PlusIcon,
  GripVerticalIcon,
  Trash2Icon,
  SaveIcon,
  LockIcon,
  UploadIcon,
  CheckCircle2Icon,
} from "lucide-react";
import { toast } from "sonner";
import type { FormFieldType } from "@/lib/domain";
import { cn } from "@/lib/utils";

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

const fieldTypeLabels: Record<FormFieldType, string> = {
  text: "Short text",
  number: "Number",
  textarea: "Long text",
  radio: "Radio buttons",
  select: "Dropdown",
  checkboxGroup: "Checkboxes",
  divider: "Divider",
  note: "Note / info",
};

const standardFields = [
  { label: "Name", type: "text", required: true },
  { label: "Email", type: "text", required: true },
  { label: "Phone", type: "text", required: false },
  { label: "Session name", type: "text", required: true },
  { label: "Attendees", type: "number", required: true },
  { label: "Details", type: "textarea", required: true },
  { label: "CC emails", type: "text", required: false },
] as const;

function parseOptions(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

type FormField = {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  helpText?: string;
  options?: string[];
};

function StandardFieldRow({
  field,
}: {
  field: { label: string; type: string; required: boolean };
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
        <LockIcon className="size-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{field.label}</p>
        <p className="text-xs text-muted-foreground capitalize">{field.type} · system field</p>
      </div>
      <StatusBadge status={field.required ? "Required" : "Optional"} />
    </div>
  );
}

function CustomFieldRow({
  field,
  index,
  onChange,
  onRemove,
}: {
  field: FormField;
  index: number;
  onChange: (id: string, patch: Partial<FormField>) => void;
  onRemove: (id: string) => void;
}) {
  const needsOptions =
    field.type === "radio" ||
    field.type === "select" ||
    field.type === "checkboxGroup";

  return (
    <div className={cn(
      "flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors",
      "hover:border-muted-foreground/20"
    )}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 cursor-grab text-muted-foreground/40 hover:text-muted-foreground">
          <GripVerticalIcon className="size-4" />
        </div>

        <div className="flex-1 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_160px_auto]">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`field-label-${field.id}`} className="sr-only">
              Field label
            </Label>
            <Input
              id={`field-label-${field.id}`}
              value={field.label}
              onChange={(e) => onChange(field.id, { label: e.target.value })}
              placeholder="Field label"
              className="h-8 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor={`field-type-${field.id}`} className="sr-only">
              Field type
            </Label>
            <Select
              value={field.type}
              onValueChange={(val) =>
                onChange(field.id, { type: val as FormFieldType })
              }
            >
              <SelectTrigger id={`field-type-${field.id}`} className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fieldTypes.map((type) => (
                  <SelectItem key={type} value={type} className="text-sm">
                    {fieldTypeLabels[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap cursor-pointer">
              <Switch
                checked={field.required}
                onCheckedChange={(checked) =>
                  onChange(field.id, { required: checked })
                }
                className="scale-75 origin-left"
              />
              Required
            </label>

            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={() => onRemove(field.id)}
              aria-label={`Remove field ${field.label || index + 1}`}
            >
              <Trash2Icon className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Optional secondary row: help text + options */}
      <div className="grid grid-cols-1 gap-2 pl-7 sm:grid-cols-2">
        <Input
          value={field.helpText ?? ""}
          onChange={(e) =>
            onChange(field.id, { helpText: e.target.value || undefined })
          }
          placeholder="Help text (optional)"
          className="h-7 text-xs"
        />
        {needsOptions && (
          <Input
            value={field.options?.join(", ") ?? ""}
            onChange={(e) =>
              onChange(field.id, { options: parseOptions(e.target.value) })
            }
            placeholder="Options, comma separated"
            className="h-7 text-xs"
          />
        )}
      </div>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-6 py-4">
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-14 rounded-lg" />
      ))}
    </div>
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
  const fields = (formConfig?.fields ?? []) as FormField[];
  const [draftFields, setDraftFields] = useState<FormField[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const activeFields = draftFields ?? fields;

  function handleFieldChange(id: string, patch: Partial<FormField>) {
    setDraftFields(
      activeFields.map((f) => (f.id === id ? { ...f, ...patch } : f))
    );
  }

  function handleRemoveField(id: string) {
    setDraftFields(activeFields.filter((f) => f.id !== id));
  }

  function handleAddField() {
    setDraftFields([
      ...activeFields,
      {
        id: crypto.randomUUID(),
        label: "Custom question",
        type: "text",
        required: false,
      },
    ]);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveForm({
        tenantSlug,
        auth,
        fileUploadEnabled: Boolean(formConfig?.fileUploadEnabled),
        fields: activeFields,
      });
      setDraftFields(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      toast.success("Form configuration saved.");
    } catch {
      toast.error("Failed to save form configuration.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleUploads(enabled: boolean) {
    try {
      await saveForm({
        tenantSlug,
        auth,
        fileUploadEnabled: enabled,
        fields: activeFields,
      });
      toast.success(enabled ? "File uploads enabled." : "File uploads disabled.");
    } catch {
      toast.error("Failed to update file upload setting.");
    }
  }

  const isLoading = formConfig === undefined;
  const isDirty = draftFields !== null;

  return (
    <div className="flex flex-col gap-8 pb-16">
      <AdminPageHeader
        title="Request Form"
        description="Customise the fields shown when staff submit a booking request. Standard fields are locked and always shown first."
        breadcrumbs={[{ label: "Request Form" }]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleAddField}
            >
              <PlusIcon className="size-3.5" data-icon="inline-start" />
              Add field
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={handleSave}
              disabled={saving || !isDirty}
            >
              {saved ? (
                <>
                  <CheckCircle2Icon className="size-3.5 text-primary" data-icon="inline-start" />
                  Saved
                </>
              ) : (
                <>
                  <SaveIcon className="size-3.5" data-icon="inline-start" />
                  {saving ? "Saving…" : "Save form"}
                </>
              )}
            </Button>
          </div>
        }
      />

      {/* Standard / locked fields */}
      <AdminSettingsCard
        title="Standard fields"
        description="These fields are required by SimHub and appear on every booking request. They cannot be removed or reordered."
        icon={<LockIcon className="size-4" />}
      >
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {standardFields.map((field) => (
              <StandardFieldRow key={field.label} field={field} />
            ))}
          </div>
        )}

        <Separator className="my-4" />

        {/* File upload toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div className="flex items-center gap-3">
            <div className="flex size-7 items-center justify-center rounded-md bg-muted">
              <UploadIcon className="size-3.5 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium text-foreground">File uploads</p>
              <p className="text-xs text-muted-foreground">
                Allow requesters to attach documents or images to their booking request.
              </p>
            </div>
          </div>
          <Switch
            checked={Boolean(formConfig?.fileUploadEnabled)}
            onCheckedChange={handleToggleUploads}
            disabled={isLoading}
          />
        </div>
      </AdminSettingsCard>

      {/* Custom fields */}
      <AdminSettingsCard
        title="Custom fields"
        description="Add extra questions for your requesters. Drag to reorder, toggle required status, and add help text."
        icon={<FormInputIcon className="size-4" />}
      >
        {isLoading ? (
          <FormSkeleton />
        ) : activeFields.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted">
              <FormInputIcon className="size-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">No custom fields yet</p>
              <p className="text-xs text-muted-foreground">
                Click &ldquo;Add field&rdquo; to add questions beyond the standard fields.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={handleAddField} className="gap-1.5">
              <PlusIcon className="size-3.5" data-icon="inline-start" />
              Add field
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {activeFields.map((field, index) => (
              <CustomFieldRow
                key={field.id}
                field={field}
                index={index}
                onChange={handleFieldChange}
                onRemove={handleRemoveField}
              />
            ))}

            <div className="flex justify-end pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={handleAddField}
              >
                <PlusIcon className="size-3.5" data-icon="inline-start" />
                Add another field
              </Button>
            </div>
          </div>
        )}
      </AdminSettingsCard>

      {isDirty && (
        <div className="fixed bottom-6 right-6 z-20 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg">
          <p className="text-sm font-medium text-foreground">Unsaved changes</p>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => setDraftFields(null)}
          >
            Discard
          </Button>
          <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
            <SaveIcon className="size-3.5" data-icon="inline-start" />
            {saving ? "Saving…" : "Save form"}
          </Button>
        </div>
      )}
    </div>
  );
}
