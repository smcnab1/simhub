import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type Ctx = QueryCtx | MutationCtx;

type WorkOSIdentity = {
  subject?: string;
  email?: string;
  name?: string;
  org_id?: string;
  organizationId?: string;
};

export type TenantRole = "Admin" | "Staff" | "Requester";

function identityOrgId(identity: WorkOSIdentity) {
  return identity.org_id ?? identity.organizationId;
}

export async function tenantBySlug(ctx: Ctx, slug: string) {
  return await ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", slug)).unique();
}

export async function requireIdentity(ctx: Ctx) {
  const identity = (await ctx.auth.getUserIdentity()) as WorkOSIdentity | null;
  if (!identity) {
    throw new Error("Authentication required");
  }
  return identity;
}

export async function requireTenantAccess(ctx: Ctx, tenantSlug: string) {
  const [identity, tenant] = await Promise.all([requireIdentity(ctx), tenantBySlug(ctx, tenantSlug)]);
  if (!tenant) {
    throw new Error("Tenant not found");
  }

  const orgId = identityOrgId(identity);
  if (tenant.workosOrganizationId && tenant.workosOrganizationId !== orgId) {
    throw new Error("Tenant access denied");
  }

  let user: Doc<"users"> | null = null;
  if (identity.subject) {
    const matches = await ctx.db.query("users").withIndex("by_workos_user", (q) => q.eq("workosUserId", identity.subject!)).collect();
    user = matches.find((match) => match.tenantId === tenant._id) ?? null;
  }

  if (!user && identity.email) {
    user = await ctx.db.query("users").withIndex("by_tenant_email", (q) => q.eq("tenantId", tenant._id).eq("email", identity.email!)).unique();
  }

  return { identity, tenant, user };
}

export async function requireStaff(ctx: Ctx, tenantSlug: string) {
  const access = await requireTenantAccess(ctx, tenantSlug);
  const tenantUsers = await ctx.db.query("users").withIndex("by_tenant_role", (q) => q.eq("tenantId", access.tenant._id)).collect();
  if ((!access.user && tenantUsers.length > 0) || access.user?.role === "Requester") {
    throw new Error("Staff access required");
  }
  return access;
}

export async function requireAdmin(ctx: Ctx, tenantSlug: string) {
  const access = await requireTenantAccess(ctx, tenantSlug);
  const tenantUsers = await ctx.db.query("users").withIndex("by_tenant_role", (q) => q.eq("tenantId", access.tenant._id)).collect();
  if ((!access.user && tenantUsers.length > 0) || (access.user && access.user.role !== "Admin")) {
    throw new Error("Admin access required");
  }
  return access;
}
