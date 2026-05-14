import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { authContextValidator, requireStaff, tenantBySlug } from "./authz";
import { hasBookingConflict } from "../src/lib/booking-logic";

async function withAssignedRooms(ctx: QueryCtx, request: Doc<"bookingRequests">) {
  const rooms = await Promise.all(request.assignedRoomIds.map((roomId: Id<"rooms">) => ctx.db.get(roomId)));
  const assignedRooms = rooms.filter((room): room is Doc<"rooms"> => room !== null);
  return {
    ...request,
    assignedRooms: assignedRooms.map((room) => ({ _id: room._id, code: room.code, name: room.name })),
  };
}

export const listPublicEvents = query({
  args: { tenantSlug: v.string(), month: v.string() },
  handler: async (ctx, args) => {
    const tenant = await tenantBySlug(ctx, args.tenantSlug);
    if (!tenant) return [];
    const requests = await ctx.db.query("bookingRequests").withIndex("by_tenant_status", (q) => q.eq("tenantId", tenant._id).eq("status", "Approved")).collect();
    const filtered = requests.filter((request) => request.blocks.some((block) => block.start.startsWith(args.month)));
    return await Promise.all(filtered.map((request) => withAssignedRooms(ctx, request)));
  },
});

export const listRequests = query({
  args: { tenantSlug: v.string(), auth: authContextValidator },
  handler: async (ctx, args) => {
    const { tenant } = await requireStaff(ctx, args.tenantSlug, args.auth);
    const requests = await ctx.db.query("bookingRequests").withIndex("by_tenant_created", (q) => q.eq("tenantId", tenant._id)).order("desc").collect();
    return await Promise.all(requests.map((request) => withAssignedRooms(ctx, request)));
  },
});

export const getRequest = query({
  args: { tenantSlug: v.optional(v.string()), auth: v.optional(authContextValidator), requestId: v.id("bookingRequests") },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) return null;
    if (args.tenantSlug) {
      const { tenant } = await requireStaff(ctx, args.tenantSlug, args.auth ?? {});
      if (request.tenantId !== tenant._id) throw new Error("Request not found");
    }
    const withRooms = await withAssignedRooms(ctx, request);
    const comments = await ctx.db.query("comments").withIndex("by_request", (q) => q.eq("requestId", args.requestId)).collect();
    return { ...withRooms, comments: args.tenantSlug ? comments : comments.filter((comment) => !comment.internal) };
  },
});

export const dashboardSummary = query({
  args: { tenantSlug: v.string(), auth: authContextValidator },
  handler: async (ctx, args) => {
    const { tenant } = await requireStaff(ctx, args.tenantSlug, args.auth);
    const [pending, approved, unseen, blockedTimes] = await Promise.all([
      ctx.db.query("bookingRequests").withIndex("by_tenant_status", (q) => q.eq("tenantId", tenant._id).eq("status", "Pending")).collect(),
      ctx.db.query("bookingRequests").withIndex("by_tenant_status", (q) => q.eq("tenantId", tenant._id).eq("status", "Approved")).collect(),
      ctx.db.query("notifications").withIndex("by_tenant_seen", (q) => q.eq("tenantId", tenant._id).eq("seen", false)).collect(),
      ctx.db.query("blockedTimes").withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id)).collect(),
    ]);
    return { pending: pending.length, approved: approved.length, unseen: unseen.length, conflicts: blockedTimes.length };
  },
});

export const createRequest = mutation({
  args: {
    tenantId: v.id("tenants"),
    requesterName: v.string(),
    requesterEmail: v.string(),
    requesterPhone: v.optional(v.string()),
    sessionName: v.string(),
    attendeeCount: v.number(),
    details: v.string(),
    ccEmails: v.array(v.string()),
    timezone: v.string(),
    blocks: v.array(v.object({ label: v.union(v.literal("Setup"), v.literal("Session"), v.literal("Cleanup")), start: v.string(), end: v.string() })),
    roomTypeRequests: v.array(v.object({ roomTypeId: v.id("roomTypes"), quantity: v.number() })),
    customInputs: v.array(v.object({ fieldId: v.string(), label: v.string(), value: v.any() })),
    attachmentStorageIds: v.array(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const requestId = await ctx.db.insert("bookingRequests", {
      ...args,
      assignedRoomIds: [],
      status: "Pending",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("notifications", {
      tenantId: args.tenantId,
      requestId,
      message: `New pending request: ${args.sessionName}`,
      seen: false,
      createdAt: now,
    });
    return requestId;
  },
});

export const updateStatus = mutation({
  args: {
    tenantSlug: v.string(),
    auth: authContextValidator,
    requestId: v.id("bookingRequests"),
    status: v.union(v.literal("Pending"), v.literal("Approved"), v.literal("Completed"), v.literal("Declined"), v.literal("Cancelled")),
    assignedRoomIds: v.optional(v.array(v.id("rooms"))),
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireStaff(ctx, args.tenantSlug, args.auth);
    const request = await ctx.db.get(args.requestId);
    if (!request || request.tenantId !== tenant._id) throw new Error("Request not found");
    await ctx.db.patch(args.requestId, {
      status: args.status,
      assignedRoomIds: args.assignedRoomIds ?? request.assignedRoomIds,
      updatedAt: Date.now(),
    });
  },
});

export const addComment = mutation({
  args: {
    tenantSlug: v.string(),
    auth: authContextValidator,
    requestId: v.id("bookingRequests"),
    bodyMarkdown: v.string(),
    internal: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { tenant, user } = await requireStaff(ctx, args.tenantSlug, args.auth);
    const request = await ctx.db.get(args.requestId);
    if (!request || request.tenantId !== tenant._id) throw new Error("Request not found");
    return await ctx.db.insert("comments", {
      tenantId: tenant._id,
      requestId: args.requestId,
      authorUserId: user?._id,
      bodyMarkdown: args.bodyMarkdown,
      internal: args.internal,
      createdAt: Date.now(),
    });
  },
});

export const validateAvailability = action({
  args: {
    tenantId: v.id("tenants"),
    blocks: v.array(v.object({ start: v.string(), end: v.string() })),
    roomTypeRequests: v.array(v.object({ roomTypeId: v.id("roomTypes"), quantity: v.number() })),
  },
  handler: async (ctx, args): Promise<{ available: boolean; reason?: string }> => {
    const approved = await ctx.runQuery(api.bookings.internalApprovedRequests, { tenantId: args.tenantId });
    const hasConflict = hasBookingConflict(args.blocks, approved);
    return hasConflict ? { available: false, reason: "Requested time overlaps an approved booking or blocked time." } : { available: true };
  },
});

export const internalApprovedRequests = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    return await ctx.db.query("bookingRequests").withIndex("by_tenant_status", (q) => q.eq("tenantId", args.tenantId).eq("status", "Approved")).collect();
  },
});
