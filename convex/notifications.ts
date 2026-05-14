import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authContextValidator, requireStaff } from "./authz";

export const unseen = query({
  args: { tenantId: v.id("tenants"), userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    if (args.userId) {
      return await ctx.db.query("notifications").withIndex("by_user_seen", (q) => q.eq("userId", args.userId).eq("seen", false)).collect();
    }
    return await ctx.db.query("notifications").withIndex("by_tenant_seen", (q) => q.eq("tenantId", args.tenantId).eq("seen", false)).collect();
  },
});

export const unseenByTenantSlug = query({
  args: { tenantSlug: v.string(), auth: authContextValidator },
  handler: async (ctx, args) => {
    const { tenant } = await requireStaff(ctx, args.tenantSlug, args.auth);
    return await ctx.db.query("notifications").withIndex("by_tenant_seen", (q) => q.eq("tenantId", tenant._id).eq("seen", false)).collect();
  },
});

export const markAllSeen = mutation({
  args: { tenantSlug: v.string(), auth: authContextValidator, userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const { tenant } = await requireStaff(ctx, args.tenantSlug, args.auth);
    const notifications = await ctx.db.query("notifications").withIndex("by_tenant_seen", (q) => q.eq("tenantId", tenant._id).eq("seen", false)).collect();
    await Promise.all(notifications.filter((item) => !args.userId || item.userId === args.userId).map((item) => ctx.db.patch(item._id, { seen: true })));
  },
});
