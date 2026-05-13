import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type Ctx = QueryCtx | MutationCtx;

export type TenantRole = "Admin" | "Staff" | "Requester";

export async function tenantBySlug(ctx: Ctx, slug: string) {
  return await ctx.db
    .query("tenants")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
}

export async function requireTenantAccess(ctx: Ctx, tenantSlug: string) {
  const tenant = await tenantBySlug(ctx, tenantSlug);

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  return {
    identity: null,
    tenant,
    user: null as Doc<"users"> | null,
  };
}

export async function requireStaff(ctx: Ctx, tenantSlug: string) {
  return await requireTenantAccess(ctx, tenantSlug);
}

export async function requireAdmin(ctx: Ctx, tenantSlug: string) {
  return await requireTenantAccess(ctx, tenantSlug);
}