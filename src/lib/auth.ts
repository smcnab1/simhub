import { decodeJwt } from "jose";
import { cookies } from "next/headers";
import { unsealData } from "iron-session";
import { canAccessStaff } from "./authz-logic";
import type { Role } from "./domain";

type WorkOSRoleSource = {
  metadata?: Record<string, unknown>;
  role?: unknown;
  roles?: unknown;
  user?: {
    metadata?: Record<string, unknown>;
  } | null;
} | null | undefined;

type WorkOSSessionCookie = {
  accessToken: string;
  user: {
    metadata?: Record<string, unknown>;
  } | null;
  impersonator?: unknown;
};

export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(process.env.WORKOS_COOKIE_NAME || "wos-session");
    if (!sessionCookie) {
      return { user: null };
    }

    const session = await unsealData<WorkOSSessionCookie>(sessionCookie.value, {
      password: process.env.WORKOS_COOKIE_PASSWORD!,
    });
    const claims = decodeJwt(session.accessToken);

    return {
      sessionId: typeof claims.sid === "string" ? claims.sid : undefined,
      user: session.user,
      organizationId: typeof claims.org_id === "string" ? claims.org_id : undefined,
      role: claims.role,
      roles: claims.roles,
      permissions: claims.permissions,
      entitlements: claims.entitlements,
      featureFlags: claims.feature_flags,
      impersonator: session.impersonator,
      accessToken: session.accessToken,
    };
  } catch {
    return null;
  }
}

function normalizeRole(role: unknown): Role | null {
  if (typeof role !== "string") {
    return null;
  }

  const normalized = role.toLowerCase();
  if (normalized === "developer") return "Developer";
  if (normalized === "admin") return "Admin";
  if (normalized === "staff") return "Staff";
  if (normalized === "requester" || normalized === "user") return "Requester";
  return null;
}

export function roleFromWorkOS(source?: WorkOSRoleSource): Role {
  const metadataRole = normalizeRole(source?.metadata?.role ?? source?.user?.metadata?.role);
  if (metadataRole) return metadataRole;

  const sessionRole = normalizeRole(source?.role);
  if (sessionRole) return sessionRole;

  if (Array.isArray(source?.roles)) {
    const roles = source.roles.map(normalizeRole);
    if (roles.includes("Developer")) return "Developer";
    if (roles.includes("Admin")) return "Admin";
    if (roles.includes("Staff")) return "Staff";
    if (roles.includes("Requester")) return "Requester";
  }

  return source?.user ? "Staff" : "Requester";
}

export function canUseDashboard(role: Role) {
  return canAccessStaff(role);
}
