import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../convex/_generated/api";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAdmin, canAccessStaff } from "@/lib/authz-logic";
import { TENANT_SLUG } from "@/lib/config";
import type { Role } from "@/lib/domain";

type DashboardAccessOptions = {
  requiredRole?: "staff" | "admin";
};

export type DashboardAccess =
  | {
      ok: true;
      auth: {
        tenantSlug: string;
        tenantName?: string;
        role: Role;
        workosUserId?: string;
        email?: string;
        workosOrganizationId?: string;
      };
    }
  | {
      ok: false;
      reason: "insufficient_role";
      role: Role;
      tenantName?: string;
    };

function hasRequiredRole(role: Role, requiredRole: "staff" | "admin") {
  return requiredRole === "admin" ? canAccessAdmin(role) : canAccessStaff(role);
}

export async function getDashboardAccess({
  requiredRole = "staff",
}: DashboardAccessOptions = {}): Promise<DashboardAccess> {
  const session = await getCurrentUser();

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const workosUser = session.user as { id?: string; email?: string };
  const authIdentity = {
    workosUserId: workosUser.id,
    email: workosUser.email,
    workosOrganizationId: session.organizationId,
  };
  const memberships = await fetchQuery(api.tenants.listMembershipsForAuth, {
    auth: authIdentity,
  });
  const cookieStore = await cookies();
  const selectedSlug =
    cookieStore.get("simhub-tenant-slug")?.value || TENANT_SLUG;
  const selectedMembership =
    memberships.find((membership) => membership.tenantSlug === selectedSlug) ??
    memberships.find((membership) => canAccessStaff(membership.role));

  if (!selectedMembership || !canAccessStaff(selectedMembership.role)) {
    redirect("/auth/access");
  }

  if (!hasRequiredRole(selectedMembership.role, requiredRole)) {
    return {
      ok: false,
      reason: "insufficient_role",
      role: selectedMembership.role,
      tenantName: selectedMembership.tenantName,
    };
  }

  return {
    ok: true,
    auth: {
      ...authIdentity,
      tenantSlug: selectedMembership.tenantSlug,
      tenantName: selectedMembership.tenantName,
      role: selectedMembership.role,
    },
  };
}
