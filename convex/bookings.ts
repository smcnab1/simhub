import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { authContextValidator, requireStaff, tenantBySlug } from "./authz";
import {
  allocateRoomsByType,
  hasBookingConflict,
  validateMaxBookingDuration,
} from "../src/lib/booking-logic";
import { campusIsActive } from "../src/lib/campus";

async function withAssignedRooms(ctx: QueryCtx, request: Doc<"bookingRequests">) {
  const rooms = await Promise.all(request.assignedRoomIds.map((roomId: Id<"rooms">) => ctx.db.get(roomId)));
  const assignedRooms = rooms.filter((room): room is Doc<"rooms"> => room !== null);
  return {
    ...request,
    assignedRooms: assignedRooms.map((room) => ({ _id: room._id, code: room.code, name: room.name })),
  };
}

function bookingEndsInFuture(request: Doc<"bookingRequests">) {
  const latestEnd = Math.max(...request.blocks.map((block) => Date.parse(block.end)));
  return Number.isFinite(latestEnd) && latestEnd > Date.now();
}

async function validateRoomTypeRequests(
  ctx: QueryCtx,
  tenantId: Id<"tenants">,
  blocks: Array<{ start: string; end: string }>,
  roomTypeRequests: Array<{ roomTypeId: Id<"roomTypes">; quantity: number }>
) {
  if (roomTypeRequests.length === 0) {
    throw new Error("Select at least one room type.");
  }

  const selectedRoomTypes: Array<{
    id: string;
    name: string;
    maxBookingDurationMinutes?: number;
  }> = [];

  for (const request of roomTypeRequests) {
    if (!Number.isInteger(request.quantity) || request.quantity <= 0) {
      throw new Error("Room quantities must be whole numbers greater than zero.");
    }

    const roomType = await ctx.db.get(request.roomTypeId);

    if (!roomType || roomType.tenantId !== tenantId || !roomType.active) {
      throw new Error("Selected room type is no longer available.");
    }

    if (roomType.campusId) {
      const campus = await ctx.db.get(roomType.campusId);

      if (!campus || campus.tenantId !== tenantId || !campusIsActive(campus)) {
        throw new Error("Selected campus is no longer available for new bookings.");
      }
    }

    selectedRoomTypes.push({
      id: roomType._id,
      name: roomType.name,
      maxBookingDurationMinutes:
        roomType.maxBookingDurationMinutes ??
        (roomType.maxDurationHours !== undefined
          ? roomType.maxDurationHours * 60
          : undefined),
    });

    const activeRooms = await ctx.db
      .query("rooms")
      .withIndex("by_tenant_type", (q) =>
        q.eq("tenantId", tenantId).eq("roomTypeId", request.roomTypeId)
      )
      .collect();

    const selectableRooms = (
      await Promise.all(
        activeRooms.map(async (room) => {
          if (!room.active) {
            return null;
          }

          if (!room.campusId) {
            return room;
          }

          const campus = await ctx.db.get(room.campusId);
          return campus && campus.tenantId === tenantId && campusIsActive(campus)
            ? room
            : null;
        })
      )
    ).filter((room): room is Doc<"rooms"> => room !== null);

    if (selectableRooms.length < request.quantity) {
      throw new Error(`Not enough active rooms are available for ${roomType.name}.`);
    }
  }

  const durationError = validateMaxBookingDuration(
    blocks,
    roomTypeRequests,
    selectedRoomTypes
  );

  if (durationError) {
    throw new Error(durationError);
  }
}

async function validateAssignedRooms(
  ctx: QueryCtx,
  tenantId: Id<"tenants">,
  assignedRoomIds: Id<"rooms">[],
  requireActive: boolean
) {
  const uniqueRoomIds = new Set(assignedRoomIds);

  if (uniqueRoomIds.size !== assignedRoomIds.length) {
    throw new Error("The same room cannot be assigned more than once.");
  }

  const rooms = await Promise.all(assignedRoomIds.map((roomId) => ctx.db.get(roomId)));

  for (const room of rooms) {
    if (!room || room.tenantId !== tenantId) {
      throw new Error("One or more assigned rooms were not found.");
    }

    if (requireActive && !room.active) {
      throw new Error(`${room.name} (${room.code}) is inactive and cannot be assigned to a future booking.`);
    }

    if (requireActive && room.campusId) {
      const campus = await ctx.db.get(room.campusId);

      if (!campus || campus.tenantId !== tenantId || !campusIsActive(campus)) {
        throw new Error(`${room.name} (${room.code}) belongs to an inactive campus and cannot be assigned to a future booking.`);
      }
    }
  }
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
    await validateRoomTypeRequests(ctx, args.tenantId, args.blocks, args.roomTypeRequests);

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

    const assignedRoomIds = args.assignedRoomIds ?? request.assignedRoomIds;
    const requiresActiveRooms =
      bookingEndsInFuture(request) &&
      (args.status === "Pending" || args.status === "Approved");

    await validateAssignedRooms(ctx, tenant._id, assignedRoomIds, requiresActiveRooms);

    await ctx.db.patch(args.requestId, {
      status: args.status,
      assignedRoomIds,
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
    const [approved, rooms, roomTypes] = await Promise.all([
      ctx.runQuery(api.bookings.internalApprovedRequests, { tenantId: args.tenantId }),
      ctx.runQuery(api.bookings.internalActiveRooms, { tenantId: args.tenantId }),
      ctx.runQuery(api.bookings.internalRoomTypes, { tenantId: args.tenantId }),
    ]);
    const durationError = validateMaxBookingDuration(
      args.blocks,
      args.roomTypeRequests,
      roomTypes.map((roomType) => ({
        id: roomType._id,
        name: roomType.name,
        maxBookingDurationMinutes:
          roomType.maxBookingDurationMinutes ??
          (roomType.maxDurationHours !== undefined
            ? roomType.maxDurationHours * 60
            : undefined),
      }))
    );

    if (durationError) {
      return { available: false, reason: durationError };
    }

    const hasConflict = hasBookingConflict(args.blocks, approved);
    if (hasConflict) {
      return { available: false, reason: "Requested time overlaps an approved booking or blocked time." };
    }

    const allocation = allocateRoomsByType(
      rooms.map((room) => ({
        id: room._id,
        roomTypeId: room.roomTypeId,
        active: room.active,
      })),
      approved,
      args.blocks,
      args.roomTypeRequests
    );

    return allocation.success
      ? { available: true }
      : { available: false, reason: allocation.reason };
  },
});

export const internalApprovedRequests = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    return await ctx.db.query("bookingRequests").withIndex("by_tenant_status", (q) => q.eq("tenantId", args.tenantId).eq("status", "Approved")).collect();
  },
});

export const internalActiveRooms = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_tenant_active", (q) =>
        q.eq("tenantId", args.tenantId).eq("active", true)
      )
      .collect();

    const selectableRooms = await Promise.all(
      rooms.map(async (room) => {
        if (!room.campusId) {
          return room;
        }

        const campus = await ctx.db.get(room.campusId);
        return campus && campus.tenantId === args.tenantId && campusIsActive(campus)
          ? room
          : null;
      })
    );

    return selectableRooms.filter((room): room is Doc<"rooms"> => room !== null);
  },
});

export const internalRoomTypes = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    const roomTypes = await ctx.db
      .query("roomTypes")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    const selectableRoomTypes = await Promise.all(
      roomTypes.map(async (roomType) => {
        if (!roomType.active) {
          return null;
        }

        if (!roomType.campusId) {
          return roomType;
        }

        const campus = await ctx.db.get(roomType.campusId);
        return campus && campus.tenantId === args.tenantId && campusIsActive(campus)
          ? roomType
          : null;
      })
    );

    return selectableRoomTypes.filter((roomType): roomType is Doc<"roomTypes"> => roomType !== null);
  },
});
