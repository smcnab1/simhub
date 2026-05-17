import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../convex/_generated/api";
import { getCurrentUser, roleFromWorkOS } from "@/lib/auth";
import { canAccessAdmin, canAccessDeveloper, canAccessStaff } from "@/lib/authz-logic";
import {
  LEGACY_TENANT_COOKIE_NAME,
  TENANT_COOKIE_NAME,
  TENANT_SLUG,
} from "@/lib/config";
import type { Role } from "@/lib/domain";
import { getTenantHostResolution } from "@/lib/tenant-resolver";
import { demoTenantFallbackEnabled } from "@/lib/tenant-url";

type DashboardAccessOptions = {
  requiredRole?: "tenant" | "staff" | "admin" | "developer";
};

export type DashboardAccess =
  | {
      ok: true;
      auth: {
        tenantSlug: string;
        tenantName?: string;
        logoUrl?: string;
        role: Role;
        memberships: Array<{
          tenantName: string;
          tenantSlug: string;
          logoUrl?: string;
          role: Role;
          customDomain?: string;
          workosOrganizationId?: string;
        }>;
        user?: {
          id?: string;
          email?: string;
          firstName?: string;
          lastName?: string;
          metadata?: Record<string, unknown>;
        };
        workosUserId?: string;
        email?: string;
        platformRole?: "Developer";
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

type RawMembership = {
  tenantName?: unknown;
  tenantSlug?: unknown;
  slug?: unknown;
  tenant?: {
    name?: unknown;
    slug?: unknown;
    logoUrl?: unknown;
    customDomain?: unknown;
    workosOrganizationId?: unknown;
  } | null;
  logoUrl?: unknown;
  role?: unknown;
  customDomain?: unknown;
  workosOrganizationId?: unknown;
  tenantId?: unknown;
};

type NormalizedMembership = {
  tenantName: string;
  tenantSlug: string;
  logoUrl?: string;
  role: Role;
  customDomain?: string;
  workosOrganizationId?: string;
};

function hasRequiredRole(role: Role, requiredRole: "tenant" | "staff" | "admin" | "developer") {
  if (requiredRole === "tenant") return true;
  if (requiredRole === "developer") return canAccessDeveloper(role);
  return requiredRole === "admin" ? canAccessAdmin(role) : canAccessStaff(role);
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSlug(value: unknown) {
  return normalizeString(value).toLowerCase();
}

function normalizeRole(role: unknown): Role {
  const normalized = normalizeSlug(role);
  if (normalized === "developer") return "Developer";
  if (normalized === "admin") return "Admin";
  if (normalized === "staff") return "Staff";
  return "Requester";
}

function normalizeMembership(membership: RawMembership): NormalizedMembership {
  const tenantSlug = normalizeSlug(
    membership.tenantSlug ?? membership.slug ?? membership.tenant?.slug
  );
  const tenantName =
    normalizeString(membership.tenantName ?? membership.tenant?.name) || tenantSlug;
  const logoUrl = normalizeString(membership.logoUrl ?? membership.tenant?.logoUrl);
  const customDomain = normalizeSlug(
    membership.customDomain ?? membership.tenant?.customDomain
  );
  const workosOrganizationId = normalizeString(
    membership.workosOrganizationId ?? membership.tenant?.workosOrganizationId
  );

  return {
    tenantName,
    tenantSlug,
    role: normalizeRole(membership.role),
    ...(logoUrl ? { logoUrl } : {}),
    ...(customDomain ? { customDomain } : {}),
    ...(workosOrganizationId ? { workosOrganizationId } : {}),
  };
}

function membershipLogShape(membership: RawMembership) {
  return {
    tenantSlug: membership.tenantSlug,
    slug: membership.slug,
    "tenant?.slug": membership.tenant?.slug,
    tenantName: membership.tenantName,
    logoUrl: membership.logoUrl,
    role: membership.role,
    tenantId: membership.tenantId,
    workosOrganizationId: membership.workosOrganizationId,
  };
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
    const memberships = await fetchQuery(api.tenants.listMembershipsForAuth, { auth });
    console.info(
      "[dashboard-access] listMembershipsForAuth memberships",
      (memberships as RawMembership[]).map(membershipLogShape)
    );
    return memberships as RawMembership[];
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
  const workosProfile = session.user as {
    firstName?: string | null;
    lastName?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    name?: string | null;
    metadata?: Record<string, unknown>;
  };
  const firstName = normalizeString(workosProfile.firstName ?? workosProfile.first_name);
  const lastName = normalizeString(workosProfile.lastName ?? workosProfile.last_name);
  const authIdentity = {
    user: {
      id: workosUser.id,
      email: workosUser.email,
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
      metadata: workosProfile.metadata,
    },
    workosUserId: workosUser.id,
    email: workosUser.email,
    workosOrganizationId: session.organizationId,
    ...(roleFromWorkOS({
      user: session.user,
      role: session.role,
      roles: session.roles,
    }) === "Developer"
      ? { platformRole: "Developer" as const }
      : {}),
  };
  const rawMemberships = await listMembershipsForAuth(authIdentity);
  const memberships = rawMemberships
    .map(normalizeMembership)
    .filter((membership) => membership.tenantSlug);
  const cookieStore = await cookies();
  const hostTenant = await getTenantHostResolution();
  const hostTenantSlug =
    hostTenant.kind === "slug"
      ? normalizeSlug(hostTenant.tenantSlug)
      : hostTenant.kind === "custom"
      ? memberships.find(
          (membership) => membership.customDomain === normalizeSlug(hostTenant.customHost)
        )?.tenantSlug
      : null;
  const selectedSlug =
    hostTenantSlug ||
    normalizeSlug(cookieStore.get(TENANT_COOKIE_NAME)?.value) ||
    normalizeSlug(cookieStore.get(LEGACY_TENANT_COOKIE_NAME)?.value) ||
    (demoTenantFallbackEnabled() ? normalizeSlug(TENANT_SLUG) : "");
  const selectedMembership = hostTenantSlug
    ? memberships.find((membership) => membership.tenantSlug === hostTenantSlug)
    : (selectedSlug
        ? memberships.find((membership) => membership.tenantSlug === selectedSlug)
        : undefined) ??
      memberships.find((membership) => canAccessStaff(membership.role)) ??
      memberships[0];

  if (!selectedMembership) {
    console.warn("[dashboard-access] No selected membership", {
      hostTenantSlug,
      selectedSlug,
      rawMemberships,
      memberships,
    });

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
      logoUrl: selectedMembership.logoUrl,
      role: selectedMembership.role,
      memberships: memberships.map((membership) => ({
        tenantName: membership.tenantName,
        tenantSlug: membership.tenantSlug,
        logoUrl: membership.logoUrl,
        role: membership.role,
        customDomain: membership.customDomain,
        workosOrganizationId: membership.workosOrganizationId,
      })),
    },
  };
}
