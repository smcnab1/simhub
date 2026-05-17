import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../convex/_generated/api";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAdmin, canAccessDeveloper, canAccessStaff } from "@/lib/authz-logic";
import {
  LEGACY_TENANT_COOKIE_NAME,
  TENANT_COOKIE_NAME,
  TENANT_SLUG,
} from "@/lib/config";
import type { Role } from "@/lib/domain";
import { getTenantHostResolution } from "@/lib/tenant-resolver";

type DashboardAccessOptions = {
  requiredRole?: "tenant" | "staff" | "admin" | "developer";
};

export type DashboardAccess =
  | {
      ok: true;
      auth: {
        tenantSlug: string;
        tenantName?: string;
        role: Role;
        memberships: Array<{
          tenantName: string;
          tenantSlug: string;
          role: Role;
          customDomain?: string;
        }>;
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
    }
  | {
      ok: false;
      reason: "no_membership";
      email?: string;
    };

function hasRequiredRole(role: Role, requiredRole: "tenant" | "staff" | "admin" | "developer") {
  if (requiredRole === "tenant") return true;
  if (requiredRole === "developer") return canAccessDeveloper(role);
  return requiredRole === "admin" ? canAccessAdmin(role) : canAccessStaff(role);
}

async function listMembershipsForAuth(auth: {
  user?: {
    id?: string;
    email?: string;
  };
  workosUserId?: string;
  email?: string;
  workosOrganizationId?: string;
}) {
  try {
    return await fetchQuery(api.tenants.listMembershipsForAuth, { auth });
  } catch (error) {
    console.error("[dashboard-access] Could not load tenant memberships", error);
    return [];
  }
}

export async function getDashboardAccess({
  requiredRole = "tenant",
}: DashboardAccessOptions = {}): Promise<DashboardAccess> {
  const session = await getCurrentUser();

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const workosUser = session.user as { id?: string; email?: string };
  const authIdentity = {
    user: {
      id: workosUser.id,
      email: workosUser.email,
    },
    workosUserId: workosUser.id,
    email: workosUser.email,
    workosOrganizationId: session.organizationId,
  };
  const memberships = await listMembershipsForAuth(authIdentity);
  const cookieStore = await cookies();
  const hostTenant = await getTenantHostResolution();
  const hostTenantSlug =
    hostTenant.kind === "slug"
      ? hostTenant.tenantSlug
      : hostTenant.kind === "custom"
      ? memberships.find(
          (membership) => membership.customDomain === hostTenant.customHost
        )?.tenantSlug
      : null;
  const selectedSlug =
    hostTenantSlug ||
    cookieStore.get(TENANT_COOKIE_NAME)?.value ||
    cookieStore.get(LEGACY_TENANT_COOKIE_NAME)?.value ||
    TENANT_SLUG;
  const selectedMembership = hostTenantSlug
    ? memberships.find((membership) => membership.tenantSlug === hostTenantSlug)
    : memberships.find((membership) => membership.tenantSlug === selectedSlug) ??
      memberships.find((membership) => canAccessStaff(membership.role)) ??
      memberships[0];

  if (!selectedMembership) {
    return {
      ok: false,
      reason: "no_membership",
      email: workosUser.email,
    };
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
      memberships: memberships.map((membership) => ({
        tenantName: membership.tenantName,
        tenantSlug: membership.tenantSlug,
        role: membership.role,
        customDomain: membership.customDomain,
      })),
    },
  };
}
