import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin, requireStaff, tenantBySlug } from "./authz";

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", args.slug)).unique(),
});

export const getPrivateTenant = query({
  args: { tenantSlug: v.string() },
  handler: async (ctx, args) => {
    const { tenant } = await requireStaff(ctx, args.tenantSlug);
    return tenant;
  },
});

export const listRoomTypes = query({
  args: { tenantSlug: v.string() },
  handler: async (ctx, args) => {
    const tenant = await tenantBySlug(ctx, args.tenantSlug);
    if (!tenant) return [];
    return await ctx.db.query("roomTypes").withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id)).collect();
  },
});

export const listPrivateRoomTypes = query({
  args: { tenantSlug: v.string() },
  handler: async (ctx, args) => {
    const { tenant } = await requireStaff(ctx, args.tenantSlug);
    return await ctx.db.query("roomTypes").withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id)).collect();
  },
});

export const getFormConfig = query({
  args: { tenantSlug: v.string() },
  handler: async (ctx, args) => {
    const tenant = await tenantBySlug(ctx, args.tenantSlug);
    if (!tenant) return null;
    return await ctx.db.query("formConfigs").withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id)).first();
  },
});

export const getPrivateFormConfig = query({
  args: { tenantSlug: v.string() },
  handler: async (ctx, args) => {
    const { tenant } = await requireStaff(ctx, args.tenantSlug);
    return await ctx.db.query("formConfigs").withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id)).first();
  },
});

export const listUsers = query({
  args: { tenantSlug: v.string() },
  handler: async (ctx, args) => {
    const { tenant } = await requireAdmin(ctx, args.tenantSlug);
    return await ctx.db.query("users").withIndex("by_tenant_role", (q) => q.eq("tenantId", tenant._id)).collect();
  },
});

export const upsertFacilityDetails = mutation({
  args: {
    tenantSlug: v.string(),
    name: v.string(),
    contactEmail: v.string(),
    notificationEmails: v.array(v.string()),
    hoursOfOperation: v.string(),
    uploadMaxBytes: v.number(),
    logoStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireAdmin(ctx, args.tenantSlug);
    await ctx.db.patch(tenant._id, {
      name: args.name,
      contactEmail: args.contactEmail,
      notificationEmails: args.notificationEmails,
      hoursOfOperation: args.hoursOfOperation,
      uploadMaxBytes: args.uploadMaxBytes,
      logoStorageId: args.logoStorageId,
    });
  },
});

export const upsertRoomType = mutation({
  args: {
    tenantSlug: v.string(),
    roomTypeId: v.optional(v.id("roomTypes")),
    name: v.string(),
    maxDurationHours: v.number(),
    capacity: v.number(),
    quantity: v.number(),
    isSpecial: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireAdmin(ctx, args.tenantSlug);
    const payload = {
      tenantId: tenant._id,
      name: args.name,
      maxDurationHours: args.maxDurationHours,
      capacity: args.capacity,
      quantity: args.quantity,
      isSpecial: args.isSpecial,
    };

    if (args.roomTypeId) {
      const roomType = await ctx.db.get(args.roomTypeId);
      if (!roomType || roomType.tenantId !== tenant._id) throw new Error("Room type not found");
      await ctx.db.patch(args.roomTypeId, payload);
      return args.roomTypeId;
    }

    return await ctx.db.insert("roomTypes", payload);
  },
});

export const deleteRoomType = mutation({
  args: { tenantSlug: v.string(), roomTypeId: v.id("roomTypes") },
  handler: async (ctx, args) => {
    const { tenant } = await requireAdmin(ctx, args.tenantSlug);
    const roomType = await ctx.db.get(args.roomTypeId);
    if (!roomType || roomType.tenantId !== tenant._id) throw new Error("Room type not found");
    await ctx.db.delete(args.roomTypeId);
  },
});

const formFieldValidator = v.object({
  id: v.string(),
  label: v.string(),
  type: v.union(v.literal("text"), v.literal("number"), v.literal("textarea"), v.literal("radio"), v.literal("select"), v.literal("divider"), v.literal("note"), v.literal("checkboxGroup")),
  required: v.boolean(),
  helpText: v.optional(v.string()),
  options: v.optional(v.array(v.string())),
});

export const upsertFormConfig = mutation({
  args: {
    tenantSlug: v.string(),
    fileUploadEnabled: v.boolean(),
    fields: v.array(formFieldValidator),
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireAdmin(ctx, args.tenantSlug);
    const existing = await ctx.db.query("formConfigs").withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id)).first();
    const payload = {
      tenantId: tenant._id,
      fileUploadEnabled: args.fileUploadEnabled,
      fields: args.fields,
    };
    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }
    return await ctx.db.insert("formConfigs", payload);
  },
});

export const upsertUser = mutation({
  args: {
    tenantSlug: v.string(),
    userId: v.optional(v.id("users")),
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal("Admin"), v.literal("Staff"), v.literal("Requester")),
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireAdmin(ctx, args.tenantSlug);
    const email = args.email.trim().toLowerCase();
    const payload = {
      tenantId: tenant._id,
      workosUserId: `email:${email}`,
      name: args.name,
      email,
      role: args.role,
    };

    if (args.userId) {
      const user = await ctx.db.get(args.userId);
      if (!user || user.tenantId !== tenant._id) throw new Error("User not found");
      await ctx.db.patch(args.userId, payload);
      return args.userId;
    }

    const existing = await ctx.db.query("users").withIndex("by_tenant_email", (q) => q.eq("tenantId", tenant._id).eq("email", email)).unique();
    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("users", payload);
  },
});

export const deleteUser = mutation({
  args: { tenantSlug: v.string(), userId: v.id("users") },
  handler: async (ctx, args) => {
    const { tenant } = await requireAdmin(ctx, args.tenantSlug);
    const user = await ctx.db.get(args.userId);
    if (!user || user.tenantId !== tenant._id) throw new Error("User not found");
    await ctx.db.delete(args.userId);
  },
});
