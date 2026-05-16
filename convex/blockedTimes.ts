import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authContextValidator, requireStaff } from "./authz";

/**
 * Blocked-time scopes determine which resources are blocked.
 */
export const BLOCKED_TIME_SCOPES = ["Room", "RoomType", "Campus", "Tenant"] as const;
export type BlockedTimeScope = (typeof BLOCKED_TIME_SCOPES)[number];

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * List all active blocked times for a tenant.
 * Admin/Staff only.
 */
export const listBlockedTimes = query({
  args: {
    tenantSlug: v.string(),
    auth: authContextValidator,
    includeAllStatuses: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireStaff(ctx, args.tenantSlug, args.auth);
    const blocks = await ctx.db
      .query("blockedTimes")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .collect();

    // Filter by status unless includeAllStatuses is true
    const filtered = args.includeAllStatuses
      ? blocks
      : blocks.filter((b) => (b.status ?? "Active") === "Active");

    // Enrich with related entity names
    const enriched = await Promise.all(
      filtered.map(async (block) => {
        let roomName: string | undefined;
        let roomTypeName: string | undefined;
        let campusName: string | undefined;
        let createdByName: string | undefined;

        if (block.roomId) {
          const room = await ctx.db.get(block.roomId);
          roomName = room?.name;
        }
        if (block.roomTypeId) {
          const roomType = await ctx.db.get(block.roomTypeId);
          roomTypeName = roomType?.name;
        }
        if (block.campusId) {
          const campus = await ctx.db.get(block.campusId);
          campusName = campus?.name;
        }
        if (block.createdByUserId) {
          const createdBy = await ctx.db.get(block.createdByUserId);
          createdByName = createdBy?.name ?? createdBy?.email;
        }

        // Derive scope if not stored
        const scope: BlockedTimeScope = block.scope
          ? (block.scope as BlockedTimeScope)
          : block.roomId
            ? "Room"
            : block.roomTypeId
              ? "RoomType"
              : block.campusId
                ? "Campus"
                : "Tenant";

        return {
          ...block,
          scope,
          roomName,
          roomTypeName,
          campusName,
          createdByName,
        };
      })
    );

    // Sort by start descending (most recent first)
    return enriched.sort(
      (a, b) => new Date(b.start).getTime() - new Date(a.start).getTime()
    );
  },
});

/**
 * List blocked times for the admin calendar view.
 * Returns blocked times that overlap the given date range.
 */
export const listBlockedTimesForCalendar = query({
  args: {
    tenantSlug: v.string(),
    auth: authContextValidator,
    rangeStart: v.string(),
    rangeEnd: v.string(),
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireStaff(ctx, args.tenantSlug, args.auth);
    const blocks = await ctx.db
      .query("blockedTimes")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .collect();

    const rangeStartTime = new Date(args.rangeStart).getTime();
    const rangeEndTime = new Date(args.rangeEnd).getTime();

    // Filter active blocks that overlap the range
    const overlapping = blocks.filter((b) => {
      if ((b.status ?? "Active") !== "Active") return false;
      const blockStart = new Date(b.start).getTime();
      const blockEnd = new Date(b.end).getTime();
      return blockStart < rangeEndTime && blockEnd > rangeStartTime;
    });

    // Enrich with names
    const enriched = await Promise.all(
      overlapping.map(async (block) => {
        let roomName: string | undefined;
        let roomTypeName: string | undefined;
        let campusName: string | undefined;

        if (block.roomId) {
          const room = await ctx.db.get(block.roomId);
          roomName = room?.name;
        }
        if (block.roomTypeId) {
          const roomType = await ctx.db.get(block.roomTypeId);
          roomTypeName = roomType?.name;
        }
        if (block.campusId) {
          const campus = await ctx.db.get(block.campusId);
          campusName = campus?.name;
        }

        const scope: BlockedTimeScope = block.scope
          ? (block.scope as BlockedTimeScope)
          : block.roomId
            ? "Room"
            : block.roomTypeId
              ? "RoomType"
              : block.campusId
                ? "Campus"
                : "Tenant";

        return {
          ...block,
          scope,
          roomName,
          roomTypeName,
          campusName,
        };
      })
    );

    return enriched;
  },
});

/**
 * Get a single blocked time by ID.
 */
export const getBlockedTime = query({
  args: {
    blockedTimeId: v.id("blockedTimes"),
  },
  handler: async (ctx, args) => {
    const block = await ctx.db.get(args.blockedTimeId);
    if (!block) return null;

    let roomName: string | undefined;
    let roomTypeName: string | undefined;
    let campusName: string | undefined;
    let createdByName: string | undefined;

    if (block.roomId) {
      const room = await ctx.db.get(block.roomId);
      roomName = room?.name;
    }
    if (block.roomTypeId) {
      const roomType = await ctx.db.get(block.roomTypeId);
      roomTypeName = roomType?.name;
    }
    if (block.campusId) {
      const campus = await ctx.db.get(block.campusId);
      campusName = campus?.name;
    }
    if (block.createdByUserId) {
      const createdBy = await ctx.db.get(block.createdByUserId);
      createdByName = createdBy?.name ?? createdBy?.email;
    }

    const scope: BlockedTimeScope = block.scope
      ? (block.scope as BlockedTimeScope)
      : block.roomId
        ? "Room"
        : block.roomTypeId
          ? "RoomType"
          : block.campusId
            ? "Campus"
            : "Tenant";

    return {
      ...block,
      scope,
      roomName,
      roomTypeName,
      campusName,
      createdByName,
    };
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Create a new blocked time period.
 * Admin/Staff only.
 */
export const createBlockedTime = mutation({
  args: {
    tenantSlug: v.string(),
    auth: authContextValidator,
    scope: v.union(
      v.literal("Room"),
      v.literal("RoomType"),
      v.literal("Campus"),
      v.literal("Tenant")
    ),
    roomId: v.optional(v.id("rooms")),
    roomTypeId: v.optional(v.id("roomTypes")),
    campusId: v.optional(v.id("campuses")),
    start: v.string(),
    end: v.string(),
    reason: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenant, user } = await requireStaff(ctx, args.tenantSlug, args.auth);

    // Validation
    const startDate = new Date(args.start);
    const endDate = new Date(args.end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error("Invalid start or end date");
    }

    if (endDate <= startDate) {
      throw new Error("End time must be after start time");
    }

    if (!args.reason.trim()) {
      throw new Error("Reason is required");
    }

    // Validate scope-specific requirements
    switch (args.scope) {
      case "Room":
        if (!args.roomId) {
          throw new Error("Room is required for Room scope");
        }
        const room = await ctx.db.get(args.roomId);
        if (!room || room.tenantId !== tenant._id) {
          throw new Error("Invalid room");
        }
        break;
      case "RoomType":
        if (!args.roomTypeId) {
          throw new Error("Room type is required for RoomType scope");
        }
        const roomType = await ctx.db.get(args.roomTypeId);
        if (!roomType || roomType.tenantId !== tenant._id) {
          throw new Error("Invalid room type");
        }
        break;
      case "Campus":
        if (!args.campusId) {
          throw new Error("Campus is required for Campus scope");
        }
        const campus = await ctx.db.get(args.campusId);
        if (!campus || campus.tenantId !== tenant._id) {
          throw new Error("Invalid campus");
        }
        break;
      case "Tenant":
        // No additional validation needed
        break;
    }

    const now = Date.now();

    const blockedTimeId = await ctx.db.insert("blockedTimes", {
      tenantId: tenant._id,
      scope: args.scope,
      roomId: args.scope === "Room" ? args.roomId : undefined,
      roomTypeId: args.scope === "RoomType" ? args.roomTypeId : undefined,
      campusId: args.scope === "Campus" ? args.campusId : undefined,
      start: args.start,
      end: args.end,
      reason: args.reason.trim(),
      notes: args.notes?.trim() || undefined,
      createdByUserId: user._id,
      status: "Active",
      createdAt: now,
      updatedAt: now,
    });

    return blockedTimeId;
  },
});

/**
 * Cancel a blocked time (soft delete).
 * Admin/Staff only.
 */
export const cancelBlockedTime = mutation({
  args: {
    tenantSlug: v.string(),
    auth: authContextValidator,
    blockedTimeId: v.id("blockedTimes"),
  },
  handler: async (ctx, args) => {
    const { tenant, user } = await requireStaff(ctx, args.tenantSlug, args.auth);
    const block = await ctx.db.get(args.blockedTimeId);

    if (!block) {
      throw new Error("Blocked time not found");
    }

    if (block.tenantId !== tenant._id) {
      throw new Error("Blocked time not found");
    }

    if ((block.status ?? "Active") === "Cancelled") {
      throw new Error("Blocked time is already cancelled");
    }

    await ctx.db.patch(args.blockedTimeId, {
      status: "Cancelled",
      cancelledAt: Date.now(),
      cancelledByUserId: user._id,
      updatedAt: Date.now(),
    });

    return args.blockedTimeId;
  },
});

/**
 * Count active blocked times for a tenant.
 * Used by dashboard summary.
 */
export const countActiveBlockedTimes = query({
  args: {
    tenantSlug: v.string(),
    auth: authContextValidator,
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireStaff(ctx, args.tenantSlug, args.auth);
    const blocks = await ctx.db
      .query("blockedTimes")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .collect();

    const now = Date.now();

    // Count active blocks that are currently in effect or upcoming
    const activeCount = blocks.filter((b) => {
      if ((b.status ?? "Active") !== "Active") return false;
      const blockEnd = new Date(b.end).getTime();
      return blockEnd > now;
    }).length;

    return activeCount;
  },
});
