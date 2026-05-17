import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";

type Ctx = QueryCtx | MutationCtx;

export type TenantRole = "Developer" | "Admin" | "Staff" | "Requester";
export type AuthzFailureCode =
  | "unauthenticated"
  | "tenant_not_found"
  | "user_not_linked_to_tenant"
  | "insufficient_role"
  | "platform_developer_required";

export const authContextValidator = v.object({
  user: v.optional(
    v.object({
      id: v.optional(v.string()),
      email: v.optional(v.string()),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      metadata: v.optional(v.any()),
    })
  ),
  tenantSlug: v.optional(v.string()),
  tenantName: v.optional(v.string()),
  platformRole: v.optional(v.literal("Developer")),
  role: v.optional(
    v.union(
      v.literal("Developer"),
      v.literal("Admin"),
      v.literal("Staff"),
      v.literal("Requester")
    )
  ),
  memberships: v.optional(
    v.array(
      v.object({
        tenantName: v.string(),
        tenantSlug: v.string(),
        tenantId: v.optional(v.string()),
        customDomain: v.optional(v.string()),
        workosOrganizationId: v.optional(v.string()),
        userId: v.optional(v.string()),
        role: v.union(
          v.literal("Developer"),
          v.literal("Admin"),
          v.literal("Staff"),
          v.literal("Requester")
        ),
      })
    )
  ),
  workosUserId: v.optional(v.string()),
  email: v.optional(v.string()),
  workosOrganizationId: v.optional(v.string()),
});

export type ConvexAuthContext = {
  user?: {
    id?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    metadata?: unknown;
  };
  tenantSlug?: string;
  tenantName?: string;
  platformRole?: "Developer";
  role?: TenantRole;
  memberships?: Array<{
    tenantName: string;
    tenantSlug: string;
    tenantId?: string;
    customDomain?: string;
    workosOrganizationId?: string;
    userId?: string;
    role: TenantRole;
  }>;
  workosUserId?: string;
  email?: string;
  workosOrganizationId?: string;
};

const STAFF_ROLES = new Set<TenantRole>(["Developer", "Admin", "Staff"]);
const ADMIN_ROLES = new Set<TenantRole>(["Developer", "Admin"]);

function fail(code: AuthzFailureCode, message: string): never {
  throw new ConvexError({ code, message });
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function workosUserIdFromAuth(auth: ConvexAuthContext) {
  return auth.workosUserId?.trim() || auth.user?.id?.trim() || null;
}

function emailFromAuth(auth: ConvexAuthContext) {
  const email = auth.email?.trim() || auth.user?.email?.trim();
  return email ? normalizeEmail(email) : null;
}

function organizationIdFromAuth(auth: ConvexAuthContext) {
  return auth.workosOrganizationId?.trim() || null;
}

export async function tenantBySlug(ctx: Ctx, slug: string) {
  const tenant = await ctx.db
    .query("tenants")
    .withIndex("by_slug", (q) => q.eq("slug", slug.trim().toLowerCase()))
    .unique();

  return tenant?.active === false ? null : tenant;
}

export async function tenantByCustomDomain(ctx: Ctx, customDomain: string) {
  const tenant = await ctx.db
    .query("tenants")
    .withIndex("by_custom_domain", (q) =>
      q.eq("customDomain", customDomain.trim().toLowerCase())
    )
    .unique();

  return tenant?.active === false ? null : tenant;
}

export async function tenantByWorkOSOrganizationId(
  ctx: Ctx,
  workosOrganizationId: string
) {
  return await ctx.db
    .query("tenants")
    .withIndex("by_workos_org", (q) =>
      q.eq("workosOrganizationId", workosOrganizationId)
    )
    .unique();
}

export async function tenantBySlugOrWorkOSOrganization(
  ctx: Ctx,
  tenantSlug: string,
  workosOrganizationId?: string | null
) {
  const tenant = await tenantBySlug(ctx, tenantSlug);

  if (tenant) {
    if (
      tenant.workosOrganizationId &&
      workosOrganizationId &&
      tenant.workosOrganizationId !== workosOrganizationId
    ) {
      fail(
        "user_not_linked_to_tenant",
        "Your WorkOS organization is not linked to this tenant."
      );
    }

    return tenant;
  }

  if (workosOrganizationId) {
    return await tenantByWorkOSOrganizationId(ctx, workosOrganizationId);
  }

  return null;
}

async function tenantUsers(ctx: Ctx, tenantId: Doc<"tenants">["_id"]) {
  const byRole = await Promise.all(
    (["Developer", "Admin", "Staff", "Requester"] as const).map((role) =>
      ctx.db
        .query("users")
        .withIndex("by_tenant_role", (q) =>
          q.eq("tenantId", tenantId).eq("role", role)
        )
        .collect()
    )
  );

  return byRole.flat();
}

async function userByWorkOSUserId(
  ctx: Ctx,
  tenantId: Doc<"tenants">["_id"],
  workosUserId: string
) {
  const users = await ctx.db
    .query("users")
    .withIndex("by_workos_user", (q) => q.eq("workosUserId", workosUserId))
    .collect();

  return users.find((user) => user.tenantId === tenantId) ?? null;
}

async function userByEmail(
  ctx: Ctx,
  tenantId: Doc<"tenants">["_id"],
  email: string
) {
  const normalizedEmail = normalizeEmail(email);
  const exactMatches = await ctx.db
    .query("users")
    .withIndex("by_tenant_email", (q) =>
      q.eq("tenantId", tenantId).eq("email", normalizedEmail)
    )
    .collect();
  const exact = exactMatches[0];

  if (exact) {
    return exact;
  }

  const users = await tenantUsers(ctx, tenantId);
  return (
    users.find((user) => normalizeEmail(user.email) === normalizedEmail) ?? null
  );
}

export async function userForTenant(
  ctx: Ctx,
  tenant: Doc<"tenants">,
  auth: ConvexAuthContext
) {
  const workosUserId = workosUserIdFromAuth(auth);
  if (workosUserId) {
    const user = await userByWorkOSUserId(ctx, tenant._id, workosUserId);
    if (user) {
      return user;
    }
  }

  const email = emailFromAuth(auth);
  if (email) {
    return await userByEmail(ctx, tenant._id, email);
  }

  return null;
}

async function findDeveloperUserForAuth(ctx: Ctx, auth: ConvexAuthContext) {
  const tenants = await ctx.db.query("tenants").collect();

  for (const tenant of tenants) {
    const user = await userForTenant(ctx, tenant, auth);
    if (user?.role === "Developer") {
      return user;
    }
  }

  return null;
}

export async function membershipsForAuth(ctx: Ctx, auth: ConvexAuthContext) {
  const workosUserId = workosUserIdFromAuth(auth);
  const email = emailFromAuth(auth);

  if (auth.memberships?.length) {
    const memberships = await Promise.all(
      auth.memberships.map(async (membership) => {
        const tenant = await tenantBySlug(ctx, membership.tenantSlug);
        if (!tenant) {
          return null;
        }

        const user = await userForTenant(ctx, tenant, auth);
        if (user) {
          return { tenant, user };
        }

        return {
          tenant,
          user: {
            _id: membership.userId ?? `membership:${tenant._id}`,
            tenantId: tenant._id,
            workosUserId: workosUserId ?? "",
            email: email ?? "",
            name: "",
            role: membership.role,
          } as Doc<"users">,
        };
      })
    );

    return memberships.filter(
      (
        membership
      ): membership is { tenant: Doc<"tenants">; user: Doc<"users"> } =>
        membership !== null
    );
  }

  if (!workosUserId && !email) {
    return [];
  }

  const tenants = await ctx.db.query("tenants").collect();
  const developerUser =
    (
      await Promise.all(
        tenants.map((tenant) => userForTenant(ctx, tenant, auth))
      )
    ).find((user) => user?.role === "Developer") ?? null;

  if (developerUser) {
    return tenants.map((tenant) => ({ tenant, user: developerUser }));
  }

  const memberships = await Promise.all(
    tenants.map(async (tenant) => {
      const user = await userForTenant(ctx, tenant, auth);
      return user ? { tenant, user } : null;
    })
  );

  return memberships.filter(
    (membership): membership is { tenant: Doc<"tenants">; user: Doc<"users"> } =>
      membership !== null
  );
}

function requireRole(user: Doc<"users">, allowedRoles: Set<TenantRole>) {
  if (!allowedRoles.has(user.role)) {
    fail(
      "insufficient_role",
      "You do not have permission to access this tenant area."
    );
  }
}

export async function requireTenantAccess(
  ctx: Ctx,
  tenantSlug: string,
  auth: ConvexAuthContext
) {
  if (!workosUserIdFromAuth(auth) && !emailFromAuth(auth)) {
    fail("unauthenticated", "Sign in to access this tenant area.");
  }

  const workosOrganizationId = organizationIdFromAuth(auth);
  let tenant = await tenantBySlug(ctx, tenantSlug);
  const developerUser = await findDeveloperUserForAuth(ctx, auth);

  if (
    tenant &&
    tenant.workosOrganizationId &&
    workosOrganizationId &&
    tenant.workosOrganizationId !== workosOrganizationId &&
    !developerUser
  ) {
    fail(
      "user_not_linked_to_tenant",
      "Your WorkOS organization is not linked to this tenant."
    );
  }

  tenant =
    tenant ??
    (workosOrganizationId
      ? await tenantByWorkOSOrganizationId(ctx, workosOrganizationId)
      : null);

  if (!tenant) {
    fail("tenant_not_found", "Tenant not found.");
  }

  const user = (await userForTenant(ctx, tenant, auth)) ?? developerUser;

  if (!user) {
    fail(
      "user_not_linked_to_tenant",
      "Your account is not linked to this tenant."
    );
  }

  return {
    identity: auth,
    tenant,
    user,
  };
}

export async function requireStaff(
  ctx: Ctx,
  tenantSlug: string,
  auth: ConvexAuthContext
) {
  const access = await requireTenantAccess(ctx, tenantSlug, auth);
  requireRole(access.user, STAFF_ROLES);
  return access;
}

export async function requireAdmin(
  ctx: Ctx,
  tenantSlug: string,
  auth: ConvexAuthContext
) {
  const access = await requireTenantAccess(ctx, tenantSlug, auth);
  requireRole(access.user, ADMIN_ROLES);
  return access;
}

export function requirePlatformDeveloper(
  _ctx: Ctx,
  auth: ConvexAuthContext
) {
  if (!workosUserIdFromAuth(auth) && !emailFromAuth(auth)) {
    fail("unauthenticated", "Sign in to access platform developer tools.");
  }

  if (auth.platformRole !== "Developer") {
    fail(
      "platform_developer_required",
      "Only platform Developer users can access this area."
    );
  }

  return {
    identity: auth,
    platformRole: auth.platformRole,
  };
}
