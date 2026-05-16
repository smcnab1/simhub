import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authContextValidator, requireTenantAccess } from "./authz";

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() ?? "";
}

function canAccessNotification(
  notification: {
    userId?: string;
    targetRoles?: Array<"Developer" | "Admin" | "Staff">;
    targetEmails?: string[];
  },
  user: { _id: string; email: string; role: "Developer" | "Admin" | "Staff" | "Requester" },
  identityEmail?: string
) {
  if (notification.userId && notification.userId !== user._id) {
    return false;
  }

  if (notification.targetRoles?.length) {
    return notification.targetRoles.includes(
      user.role as "Developer" | "Admin" | "Staff"
    );
  }

  if (notification.targetEmails?.length) {
    const visibleEmails = new Set([
      normalizeEmail(user.email),
      normalizeEmail(identityEmail),
    ]);

    return notification.targetEmails.some((email) =>
      visibleEmails.has(normalizeEmail(email))
    );
  }

  return user.role === "Developer" || user.role === "Admin" || user.role === "Staff";
}

export const unseen = query({
  args: { tenantSlug: v.string(), auth: authContextValidator },
  handler: async (ctx, args) => {
    const { tenant, user, identity } = await requireTenantAccess(ctx, args.tenantSlug, args.auth);
    const notifications = await ctx.db.query("notifications").withIndex("by_tenant_seen", (q) => q.eq("tenantId", tenant._id).eq("seen", false)).collect();
    return notifications.filter((item) => canAccessNotification(item, user, identity.email));
  },
});

export const unseenByTenantSlug = query({
  args: { tenantSlug: v.string(), auth: authContextValidator },
  handler: async (ctx, args) => {
    const { tenant, user, identity } = await requireTenantAccess(ctx, args.tenantSlug, args.auth);
    const notifications = await ctx.db.query("notifications").withIndex("by_tenant_seen", (q) => q.eq("tenantId", tenant._id).eq("seen", false)).collect();
    return notifications.filter((item) => canAccessNotification(item, user, identity.email));
  },
});

export const unseenCountByTenantSlug = query({
  args: { tenantSlug: v.string(), auth: authContextValidator },
  handler: async (ctx, args) => {
    const { tenant, user, identity } = await requireTenantAccess(ctx, args.tenantSlug, args.auth);
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_tenant_seen", (q) =>
        q.eq("tenantId", tenant._id).eq("seen", false)
      )
      .collect();

    return notifications.filter((item) => canAccessNotification(item, user, identity.email)).length;
  },
});

export const listByTenantSlug = query({
  args: {
    tenantSlug: v.string(),
    auth: authContextValidator,
    filter: v.union(v.literal("unseen"), v.literal("all")),
  },
  handler: async (ctx, args) => {
    const { tenant, user, identity } = await requireTenantAccess(ctx, args.tenantSlug, args.auth);
    const notifications =
      args.filter === "unseen"
        ? await ctx.db
            .query("notifications")
            .withIndex("by_tenant_seen", (q) =>
              q.eq("tenantId", tenant._id).eq("seen", false)
            )
            .collect()
        : [
            ...(await ctx.db
              .query("notifications")
              .withIndex("by_tenant_seen", (q) =>
                q.eq("tenantId", tenant._id).eq("seen", false)
              )
              .collect()),
            ...(await ctx.db
              .query("notifications")
              .withIndex("by_tenant_seen", (q) =>
                q.eq("tenantId", tenant._id).eq("seen", true)
              )
              .collect()),
          ];

    return notifications
      .filter((item) => canAccessNotification(item, user, identity.email))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50);
  },
});

export const markSeen = mutation({
  args: {
    tenantSlug: v.string(),
    auth: authContextValidator,
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const { tenant, user, identity } = await requireTenantAccess(ctx, args.tenantSlug, args.auth);
    const notification = await ctx.db.get(args.notificationId);

    if (
      !notification ||
      notification.tenantId !== tenant._id ||
      !canAccessNotification(notification, user, identity.email)
    ) {
      throw new Error("Notification not found");
    }

    if (!notification.seen) {
      await ctx.db.patch(notification._id, {
        seen: true,
        seenAt: Date.now(),
      });
    }
  },
});

export const markAllSeen = mutation({
  args: { tenantSlug: v.string(), auth: authContextValidator },
  handler: async (ctx, args) => {
    const { tenant, user, identity } = await requireTenantAccess(ctx, args.tenantSlug, args.auth);
    const notifications = await ctx.db.query("notifications").withIndex("by_tenant_seen", (q) => q.eq("tenantId", tenant._id).eq("seen", false)).collect();
    await Promise.all(
      notifications
        .filter((item) => canAccessNotification(item, user, identity.email))
        .map((item) => ctx.db.patch(item._id, { seen: true, seenAt: Date.now() }))
    );
  },
});
