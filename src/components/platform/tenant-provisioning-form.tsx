"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { provisionDevTenantAction } from "@/lib/platform-actions";
import type { ProvisionTenantActionState } from "@/lib/platform-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const initialState: ProvisionTenantActionState = { status: "idle" };

export function TenantProvisioningForm() {
  const [state, action, pending] = useActionState(
    provisionDevTenantAction,
    initialState
  );

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message ?? "Tenant provisioned.");
    }

    if (state.status === "error") {
      toast.error(state.message ?? "Tenant provisioning failed.");
    }
  }, [state]);

  return (
    <form action={action} className="grid gap-5">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="tenant-name">Tenant name</Label>
          <Input
            id="tenant-name"
            name="name"
            required
            placeholder="North Valley Simulation Centre"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="tenant-slug">Slug</Label>
          <Input
            id="tenant-slug"
            name="slug"
            required
            placeholder="north-valley"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="tenant-timezone">Timezone</Label>
          <Input id="tenant-timezone" name="timezone" placeholder="Europe/London" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="tenant-workos-org">WorkOS org ID</Label>
          <Input
            id="tenant-workos-org"
            name="workosOrganizationId"
            placeholder="Optional existing org"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="include-admin"
          name="includeInitialAdmin"
          type="checkbox"
          defaultChecked
          className="size-4 rounded border border-input"
        />
        <Label htmlFor="include-admin" className="text-sm font-medium">
          Create Initial Admin
        </Label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="admin-name">Primary admin name</Label>
          <Input id="admin-name" name="adminName" placeholder="Avery Stone" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="admin-email">Primary admin email</Label>
          <Input
            id="admin-email"
            name="adminEmail"
            type="email"
            placeholder="avery@example.com"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="admin-role">Role</Label>
          <Select name="adminRole" defaultValue="Admin">
            <SelectTrigger id="admin-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Admin">Admin</SelectItem>
              <SelectItem value="Staff">Staff</SelectItem>
              <SelectItem value="Requester">Requester</SelectItem>
              <SelectItem value="Developer">Developer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 pt-7 text-sm text-muted-foreground">
          <input
            type="checkbox"
            name="sendInvitation"
            defaultChecked
            className="size-4"
          />
          Send WorkOS invitation
        </label>
      </div>

      {state.status !== "idle" ? (
        <p
          className={
            state.status === "error"
              ? "text-sm text-destructive"
              : "text-sm text-muted-foreground"
          }
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Provisioning..." : "Create Tenant"}
      </Button>
    </form>
  );
}
