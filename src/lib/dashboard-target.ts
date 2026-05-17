import { fetchQuery } from "convex/nextjs";
import { api } from "../../convex/_generated/api";
import { roleFromWorkOS } from "@/lib/auth";
import { PRODUCT_ROOT_DOMAIN, normalizeHost } from "@/lib/tenant-resolver";
import { tenantAwareHref } from "@/lib/tenant-url";
import type { Role } from "@/lib/domain";

export type DashboardTargetAuth = {
  user?: {
    id?: string;
    email?: string;
    metadata?: Record<string, unknown>;
  } | null;
  workosUserId?: string;
  email?: string;
  workosOrganizationId?: string;
  organizationId?: string;
  platformRole?: "Developer";
  role?: unknown;
  roles?: unknown;
};

type RawMembership = {
  tenantName?: unknown;
  tenantSlug?: unknown;
  slug?: unknown;
  tenant?: {
    name?: unknown;
    slug?: unknown;
  } | null;
  role?: unknown;
  active?: unknown;
  status?: unknown;
};

export type DashboardTarget =
  | { kind: "dashboard"; href: string; tenantSlug: string }
  | { kind: "select-workspace"; href: "/auth/select-workspace" }
  | { kind: "access"; href: "/auth/access" };

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSlug(value: unknown) {
  return normalizeString(value).toLowerCase();
}

function isActiveMembership(membership: RawMembership) {
  if (membership.active === false) return false;
  if (normalizeString(membership.status).toLowerCase() === "inactive") return false;
  return true;
}

function normalizeMembership(membership: RawMembership) {
  const tenantSlug = normalizeSlug(
    membership.tenantSlug ?? membership.slug ?? membership.tenant?.slug
  );
  const tenantName =
    normalizeString(membership.tenantName ?? membership.tenant?.name) || tenantSlug;

  return {
    tenantName,
    tenantSlug,
    role: roleFromWorkOS({ role: membership.role }),
  };
}

function isLocalOrPreviewDashboardHost(host: string) {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".localhost") ||
    host === "vercel.app" ||
    host.endsWith(".vercel.app")
  );
}

export function dashboardHrefForTenant(tenantSlug: string, currentHost?: string | null) {
  const host = normalizeHost(currentHost);

  if (host && isLocalOrPreviewDashboardHost(host)) {
    return tenantAwareHref("/dashboard", {
      host,
      selectedTenantSlug: tenantSlug,
      queryFallbackEnabled: true,
    });
  }

  return `https://${tenantSlug}.${PRODUCT_ROOT_DOMAIN}/dashboard`;
}

export async function getDashboardTargetForUser(
  userAuth: DashboardTargetAuth,
  currentHost?: string | null
): Promise<DashboardTarget> {
  const workosUserId = userAuth.workosUserId ?? userAuth.user?.id;
  const email = userAuth.email ?? userAuth.user?.email;
  const memberships = await fetchQuery(api.tenants.listMembershipsForAuth, {
    auth: {
      user: userAuth.user ?? undefined,
      workosUserId,
      email,
      workosOrganizationId: userAuth.workosOrganizationId ?? userAuth.organizationId,
      platformRole: userAuth.platformRole,
    },
  });
  const activeMemberships = (memberships as RawMembership[])
    .filter(isActiveMembership)
    .map(normalizeMembership)
    .filter((membership) => membership.tenantSlug);

  if (activeMemberships.length === 0) {
    return { kind: "access", href: "/auth/access" };
  }

  const platformRole: Role = roleFromWorkOS(userAuth);
  const simhqMembership = activeMemberships.find(
    (membership) => membership.tenantSlug === "simhq"
  );

  if (platformRole === "Developer" && simhqMembership) {
    return {
      kind: "dashboard",
      href: dashboardHrefForTenant(simhqMembership.tenantSlug, currentHost),
      tenantSlug: simhqMembership.tenantSlug,
    };
  }

  if (activeMemberships.length === 1) {
    const [membership] = activeMemberships;
    return {
      kind: "dashboard",
      href: dashboardHrefForTenant(membership.tenantSlug, currentHost),
      tenantSlug: membership.tenantSlug,
    };
  }

  return { kind: "select-workspace", href: "/auth/select-workspace" };
}
