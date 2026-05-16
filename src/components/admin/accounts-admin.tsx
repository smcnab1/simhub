"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useDashboardAuth } from "@/components/dashboard-auth";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSettingsCard } from "@/components/admin/admin-settings-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  UsersIcon,
  UserPlusIcon,
  PencilIcon,
  Trash2Icon,
  ShieldCheckIcon,
  XIcon,
  CheckIcon,
} from "lucide-react";
import { toast } from "sonner";
import { friendlyErrorMessage } from "@/lib/errors";
import type { Role } from "@/lib/domain";
import { cn } from "@/lib/utils";

const roles = ["Admin", "Staff", "Requester"] as const satisfies readonly Role[];
type TenantAccountRole = (typeof roles)[number];

type User = {
  _id: Id<"users">;
  name: string;
  email: string;
  role: Role;
};

const roleDescriptions: Record<Role, string> = {
  Developer:
    "Platform-owner access across tenants. Managed by bootstrap tooling only.",
  Admin: "Full access to admin settings, booking management, and user accounts.",
  Staff: "Can manage bookings and view reports, but cannot change admin settings.",
  Requester: "Can submit booking requests and view their own bookings only.",
};

const roleColors: Record<Role, string> = {
  Developer: "text-foreground bg-muted border-border",
  Admin: "text-primary bg-primary/10 border-border",
  Staff: "text-primary bg-muted border-border",
  Requester: "text-primary bg-primary/10 border-border",
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function UserCardSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4">
      <Skeleton className="size-9 rounded-full" />
      <div className="flex-1 flex flex-col gap-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="h-7 w-7 rounded-md" />
      <Skeleton className="h-7 w-7 rounded-md" />
    </div>
  );
}

function EmptyUsers() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-14 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <UsersIcon className="size-5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">No accounts yet</p>
        <p className="text-xs text-muted-foreground max-w-xs mt-0.5">
          Add user accounts using the form. Users with an email matching their
          login will have the assigned role.
        </p>
      </div>
    </div>
  );
}

interface UserFormProps {
  editing: User | null;
  onSave: (data: { name: string; email: string; role: TenantAccountRole }) => Promise<void>;
  onCancel?: () => void;
}

function UserForm({ editing, onSave, onCancel }: UserFormProps) {
  const initialRole =
    editing?.role === "Admin" ||
    editing?.role === "Staff" ||
    editing?.role === "Requester"
      ? editing.role
      : "Staff";
  const [name, setName] = useState(editing?.name ?? "");
  const [email, setEmail] = useState(editing?.email ?? "");
  const [role, setRole] = useState<TenantAccountRole>(initialRole);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), email: email.trim(), role });
      if (!editing) {
        setName("");
        setEmail("");
        setRole("Staff");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="user-name">Name</Label>
        <Input
          id="user-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Smith"
          required
          autoFocus={!!editing}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="user-email">Email</Label>
        <Input
          id="user-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jane@example.com"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="user-role">Role</Label>
        <Select value={role} onValueChange={(v) => setRole(v as TenantAccountRole)}>
          <SelectTrigger id="user-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r} value={r}>
                <div className="flex flex-col">
                  <span className="font-medium">{r}</span>
                  <span className="text-xs text-muted-foreground line-clamp-1">
                    {roleDescriptions[r]}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{roleDescriptions[role]}</p>
      </div>

      <div className="flex items-center gap-2 pt-1">
        {editing && onCancel && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={onCancel}
          >
            <XIcon className="size-3.5" data-icon="inline-start" />
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          size="sm"
          disabled={saving || !name.trim() || !email.trim()}
          className="flex-1 gap-1.5"
        >
          {saving ? (
            "Saving…"
          ) : editing ? (
            <>
              <CheckIcon className="size-3.5" data-icon="inline-start" />
              Save changes
            </>
          ) : (
            <>
              <UserPlusIcon className="size-3.5" data-icon="inline-start" />
              Add user
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

export function AccountsAdmin() {
  const auth = useDashboardAuth();
  const tenantSlug = auth.tenantSlug;
  const users = useQuery(api.tenants.listUsers, { tenantSlug, auth });
  const upsertUser = useMutation(api.tenants.upsertUser);
  const deleteUser = useMutation(api.tenants.deleteUser);
  const [editingId, setEditingId] = useState<Id<"users"> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const editing = users?.find((u) => u._id === editingId) as User | undefined;
  const editingDeveloper = editing?.role === "Developer";

  async function handleSave(data: { name: string; email: string; role: TenantAccountRole }) {
    try {
      await upsertUser({
        tenantSlug,
        auth,
        userId: editingId ?? undefined,
        ...data,
      });
      setEditingId(null);
      toast.success(editingId ? "User updated." : "User added.");
    } catch (error) {
      toast.error(friendlyErrorMessage(error, "Failed to save user."));
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteUser({ tenantSlug, auth, userId: deleteTarget._id });
      toast.success("User removed.");
    } catch (error) {
      toast.error(friendlyErrorMessage(error, "Failed to remove user."));
    } finally {
      setDeleteTarget(null);
    }
  }

  const isLoading = users === undefined;

  return (
    <div className="flex flex-col gap-8 pb-16">
      <AdminPageHeader
        title="Accounts"
        description="Manage user accounts and their access roles. Users are matched by email when they log in."
        breadcrumbs={[{ label: "Accounts" }]}
      />

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        {/* Add/Edit form */}
        <AdminSettingsCard
          title={editingDeveloper ? "Developer account" : editing ? "Edit user" : "Add user"}
          description={
            editingDeveloper
              ? "Developer users are managed by bootstrap tooling."
              : editing
              ? `Editing ${editing.name}`
              : "Create a new user account and assign them a role."
          }
          icon={editing ? <PencilIcon className="size-4" /> : <UserPlusIcon className="size-4" />}
        >
          {editingDeveloper ? (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              This account has platform-level access and cannot be edited from
              tenant administration.
            </div>
          ) : (
            <UserForm
              key={editing?._id ?? "new"}
              editing={editing ?? null}
              onSave={handleSave}
              onCancel={() => setEditingId(null)}
            />
          )}
        </AdminSettingsCard>

        {/* User list */}
        <AdminSettingsCard
          title="User accounts"
          description={
            isLoading
              ? "Loading…"
              : `${users.length} user${users.length === 1 ? "" : "s"} configured`
          }
          icon={<UsersIcon className="size-4" />}
          noPadding
        >
          {isLoading ? (
            <div className="divide-y divide-border">
              {[...Array(3)].map((_, i) => (
                <UserCardSkeleton key={i} />
              ))}
            </div>
          ) : users.length === 0 ? (
            <EmptyUsers />
          ) : (
            <div className="divide-y divide-border">
              {users.map((user) => (
                <div
                  key={user._id}
                  className={cn(
                    "flex flex-wrap items-center gap-3 px-4 py-3.5 transition-colors sm:flex-nowrap sm:px-5",
                    editingId === user._id && "bg-muted/50"
                  )}
                >
                  <Avatar className="size-9 shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-muted text-muted-foreground">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {user.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </p>
                  </div>

                  <span
                    className={cn(
                      "ml-12 shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium sm:ml-0",
                      roleColors[user.role as Role]
                    )}
                  >
                    {user.role}
                  </span>

                  <div className="ml-auto flex items-center gap-1">
                    {user.role === "Developer" ? null : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => setEditingId(user._id)}
                          aria-label={`Edit ${user.name}`}
                        >
                          <PencilIcon className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteTarget(user as User)}
                          aria-label={`Delete ${user.name}`}
                        >
                          <Trash2Icon className="size-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </AdminSettingsCard>
      </div>

      {/* Roles reference */}
      <AdminSettingsCard
        title="Role reference"
        description="A summary of what each role can access."
        icon={<ShieldCheckIcon className="size-4" />}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {roles.map((r) => (
            <div
              key={r}
              className={cn(
                "flex flex-col gap-1.5 rounded-lg border p-3",
                roleColors[r]
              )}
            >
              <span className="text-sm font-semibold">{r}</span>
              <p className="text-xs opacity-80">{roleDescriptions[r]}</p>
            </div>
          ))}
        </div>
      </AdminSettingsCard>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove user?</AlertDialogTitle>
            <AlertDialogDescription>
              {`Remove ${deleteTarget?.name} (${deleteTarget?.email}) from this facility? They will no longer be able to access the admin dashboard.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove user
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
