import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { requireAdmin, requireStaff, tenantBySlug } from "./authz";

async function getRoomCountForRoomType(
  ctx: QueryCtx,
  tenantId: Id<"tenants">,
  roomTypeId: Id<"roomTypes">
) {
  const rooms = await ctx.db
    .query("rooms")
    .withIndex("by_tenant_type", (q) =>
      q.eq("tenantId", tenantId).eq("roomTypeId", roomTypeId)
    )
    .collect();

  return {
    roomCount: rooms.length,
    activeRoomCount: rooms.filter((room) => room.active).length,
  };
}

async function listTenantRooms(ctx: QueryCtx, tenantId: Id<"tenants">) {
  return await ctx.db
    .query("rooms")
    .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
    .collect();
}

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) =>
    ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique(),
});

export const getPrivateTenant = query({
  args: { tenantSlug: v.string() },
  handler: async (ctx, args) => {
    const { tenant } = await requireStaff(ctx, args.tenantSlug);
    return tenant;
  },
});

/**
 * Campuses / sites
 *
 * Tenant = client organisation.
 * Campus = site/location within the client organisation.
 */

export const listCampuses = query({
  args: { tenantSlug: v.string() },
  handler: async (ctx, args) => {
    const tenant = await tenantBySlug(ctx, args.tenantSlug);
    if (!tenant) return [];

    const campuses = await ctx.db
      .query("campuses")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .collect();

    return campuses
      .filter((campus) => campus.active ?? true)
      .sort((a, b) => {
        const aOrder = a.sortOrder ?? 9999;
        const bOrder = b.sortOrder ?? 9999;

        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.name.localeCompare(b.name);
      });
  },
});

export const listPrivateCampuses = query({
  args: {
    tenantSlug: v.string(),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireStaff(ctx, args.tenantSlug);

    const campuses = await ctx.db
      .query("campuses")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .collect();

    return campuses
      .filter((campus) =>
        args.activeOnly === false ? true : campus.active ?? true
      )
      .sort((a, b) => {
        const aOrder = a.sortOrder ?? 9999;
        const bOrder = b.sortOrder ?? 9999;

        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.name.localeCompare(b.name);
      });
  },
});

export const upsertCampus = mutation({
  args: {
    tenantSlug: v.string(),
    campusId: v.optional(v.id("campuses")),
    name: v.string(),
    active: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireAdmin(ctx, args.tenantSlug);

    const name = args.name.trim();

    if (!name) {
      throw new Error("Campus name is required");
    }

    const payload = {
      tenantId: tenant._id,
      name,
      active: args.active ?? true,
      sortOrder: args.sortOrder,
    };

    if (args.campusId) {
      const campus = await ctx.db.get(args.campusId);

      if (!campus || campus.tenantId !== tenant._id) {
        throw new Error("Campus not found");
      }

      await ctx.db.patch(args.campusId, payload);
      return args.campusId;
    }

    return await ctx.db.insert("campuses", payload);
  },
});

export const deleteCampus = mutation({
  args: {
    tenantSlug: v.string(),
    campusId: v.id("campuses"),
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireAdmin(ctx, args.tenantSlug);
    const campus = await ctx.db.get(args.campusId);

    if (!campus || campus.tenantId !== tenant._id) {
      throw new Error("Campus not found");
    }

    const [roomTypes, rooms] = await Promise.all([
      ctx.db
        .query("roomTypes")
        .withIndex("by_tenant_campus", (q) =>
          q.eq("tenantId", tenant._id).eq("campusId", args.campusId)
        )
        .collect(),
      ctx.db
        .query("rooms")
        .withIndex("by_tenant_campus", (q) =>
          q.eq("tenantId", tenant._id).eq("campusId", args.campusId)
        )
        .collect(),
    ]);

    if (roomTypes.length > 0 || rooms.length > 0) {
      await ctx.db.patch(args.campusId, {
        active: false,
      });

      return args.campusId;
    }

    await ctx.db.delete(args.campusId);
    return args.campusId;
  },
});

/**
 * Room types
 *
 * Room type = category/template, e.g. Classroom, Ward, Immersive Room.
 * Quantity comes from active rooms linked to that room type.
 */

export const listRoomTypes = query({
  args: {
    tenantSlug: v.string(),
    campusId: v.optional(v.id("campuses")),
  },
  handler: async (ctx, args) => {
    const tenant = await tenantBySlug(ctx, args.tenantSlug);
    if (!tenant) return [];

    const roomTypes = args.campusId
      ? await ctx.db
          .query("roomTypes")
          .withIndex("by_tenant_campus", (q) =>
            q.eq("tenantId", tenant._id).eq("campusId", args.campusId)
          )
          .collect()
      : await ctx.db
          .query("roomTypes")
          .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
          .collect();

    const enriched = await Promise.all(
      roomTypes
        .filter((roomType) => roomType.active)
        .map(async (roomType) => {
          const counts = await getRoomCountForRoomType(
            ctx,
            tenant._id,
            roomType._id
          );

          const campus = roomType.campusId
            ? await ctx.db.get(roomType.campusId)
            : null;

          return {
            ...roomType,
            ...counts,
            campus,
          };
        })
    );

    return enriched.sort((a, b) => {
      const aOrder = a.sortOrder ?? 9999;
      const bOrder = b.sortOrder ?? 9999;

      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.name.localeCompare(b.name);
    });
  },
});

export const listPrivateRoomTypes = query({
  args: {
    tenantSlug: v.string(),
    campusId: v.optional(v.id("campuses")),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireStaff(ctx, args.tenantSlug);

    const roomTypes = args.campusId
      ? await ctx.db
          .query("roomTypes")
          .withIndex("by_tenant_campus", (q) =>
            q.eq("tenantId", tenant._id).eq("campusId", args.campusId)
          )
          .collect()
      : await ctx.db
          .query("roomTypes")
          .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
          .collect();

    const filtered = args.activeOnly === false
      ? roomTypes
      : roomTypes.filter((roomType) => roomType.active);

    const enriched = await Promise.all(
      filtered.map(async (roomType) => {
        const counts = await getRoomCountForRoomType(
          ctx,
          tenant._id,
          roomType._id
        );

        const campus = roomType.campusId
          ? await ctx.db.get(roomType.campusId)
          : null;

        return {
          ...roomType,
          ...counts,
          campus,
        };
      })
    );

    return enriched.sort((a, b) => {
      const aOrder = a.sortOrder ?? 9999;
      const bOrder = b.sortOrder ?? 9999;

      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.name.localeCompare(b.name);
    });
  },
});

export const upsertRoomType = mutation({
  args: {
    tenantSlug: v.string(),
    roomTypeId: v.optional(v.id("roomTypes")),
    campusId: v.optional(v.id("campuses")),
    name: v.string(),
    description: v.optional(v.string()),
    defaultCapacity: v.number(),
    maxDurationHours: v.optional(v.number()),
    isSpecial: v.boolean(),
    active: v.boolean(),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireAdmin(ctx, args.tenantSlug);
    const now = Date.now();

    if (args.campusId) {
      const campus = await ctx.db.get(args.campusId);

      if (!campus || campus.tenantId !== tenant._id) {
        throw new Error("Campus not found");
      }
    }

    const name = args.name.trim();

    if (!name) {
      throw new Error("Room type name is required");
    }

    if (args.defaultCapacity < 0) {
      throw new Error("Default capacity cannot be negative");
    }

    if (args.maxDurationHours !== undefined && args.maxDurationHours <= 0) {
      throw new Error("Maximum duration must be greater than zero");
    }

    const payload = {
      tenantId: tenant._id,
      campusId: args.campusId,
      name,
      description: args.description?.trim() || undefined,
      defaultCapacity: args.defaultCapacity,
      maxDurationHours: args.maxDurationHours,
      isSpecial: args.isSpecial,
      active: args.active,
      sortOrder: args.sortOrder,
      updatedAt: now,
    };

    if (args.roomTypeId) {
      const roomType = await ctx.db.get(args.roomTypeId);

      if (!roomType || roomType.tenantId !== tenant._id) {
        throw new Error("Room type not found");
      }

      await ctx.db.patch(args.roomTypeId, payload);
      return args.roomTypeId;
    }

    return await ctx.db.insert("roomTypes", {
      ...payload,
      createdAt: now,
    });
  },
});

export const deleteRoomType = mutation({
  args: {
    tenantSlug: v.string(),
    roomTypeId: v.id("roomTypes"),
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireAdmin(ctx, args.tenantSlug);
    const roomType = await ctx.db.get(args.roomTypeId);

    if (!roomType || roomType.tenantId !== tenant._id) {
      throw new Error("Room type not found");
    }

    const linkedRooms = await ctx.db
      .query("rooms")
      .withIndex("by_tenant_type", (q) =>
        q.eq("tenantId", tenant._id).eq("roomTypeId", args.roomTypeId)
      )
      .collect();

    if (linkedRooms.length > 0) {
      await ctx.db.patch(args.roomTypeId, {
        active: false,
        updatedAt: Date.now(),
      });

      return args.roomTypeId;
    }

    await ctx.db.delete(args.roomTypeId);
    return args.roomTypeId;
  },
});

/**
 * Rooms
 *
 * Room = actual bookable physical space, e.g. PH900, PH901, PH902.
 */

export const listRooms = query({
  args: {
    tenantSlug: v.string(),
    campusId: v.optional(v.id("campuses")),
    roomTypeId: v.optional(v.id("roomTypes")),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const tenant = await tenantBySlug(ctx, args.tenantSlug);
    if (!tenant) return [];

    const { campusId, roomTypeId } = args;

    let rooms;

    if (roomTypeId !== undefined) {
      rooms = await ctx.db
        .query("rooms")
        .withIndex("by_tenant_type", (q) =>
          q.eq("tenantId", tenant._id).eq("roomTypeId", roomTypeId)
        )
        .collect();
    } else if (campusId !== undefined) {
      rooms = await ctx.db
        .query("rooms")
        .withIndex("by_tenant_campus", (q) =>
          q.eq("tenantId", tenant._id).eq("campusId", campusId)
        )
        .collect();
    } else {
      rooms = await listTenantRooms(ctx, tenant._id);
    }

    const filtered =
      args.activeOnly === false ? rooms : rooms.filter((room) => room.active);

    const enriched = await Promise.all(
      filtered.map(async (room) => {
        const [roomType, campus] = await Promise.all([
          ctx.db.get(room.roomTypeId),
          room.campusId ? ctx.db.get(room.campusId) : Promise.resolve(null),
        ]);

        return {
          ...room,
          roomType,
          campus,
        };
      })
    );

    return enriched.sort((a, b) => a.code.localeCompare(b.code));
  },
});

export const listPrivateRooms = query({
  args: {
    tenantSlug: v.string(),
    campusId: v.optional(v.id("campuses")),
    roomTypeId: v.optional(v.id("roomTypes")),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireStaff(ctx, args.tenantSlug);

    const { campusId, roomTypeId } = args;

    let rooms;

    if (roomTypeId !== undefined) {
      rooms = await ctx.db
        .query("rooms")
        .withIndex("by_tenant_type", (q) =>
          q.eq("tenantId", tenant._id).eq("roomTypeId", roomTypeId)
        )
        .collect();
    } else if (campusId !== undefined) {
      rooms = await ctx.db
        .query("rooms")
        .withIndex("by_tenant_campus", (q) =>
          q.eq("tenantId", tenant._id).eq("campusId", campusId)
        )
        .collect();
    } else {
      rooms = await listTenantRooms(ctx, tenant._id);
    }

    const filtered = args.activeOnly
      ? rooms.filter((room) => room.active)
      : rooms;

    const enriched = await Promise.all(
      filtered.map(async (room) => {
        const [roomType, campus] = await Promise.all([
          ctx.db.get(room.roomTypeId),
          room.campusId ? ctx.db.get(room.campusId) : Promise.resolve(null),
        ]);

        return {
          ...room,
          roomType,
          campus,
        };
      })
    );

    return enriched.sort((a, b) => a.code.localeCompare(b.code));
  },
});

export const upsertRoom = mutation({
  args: {
    tenantSlug: v.string(),
    roomId: v.optional(v.id("rooms")),
    campusId: v.optional(v.id("campuses")),
    roomTypeId: v.id("roomTypes"),
    code: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    capacity: v.number(),
    imageStorageId: v.optional(v.id("_storage")),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireAdmin(ctx, args.tenantSlug);
    const now = Date.now();

    const roomType = await ctx.db.get(args.roomTypeId);

    if (!roomType || roomType.tenantId !== tenant._id) {
      throw new Error("Room type not found");
    }

    if (args.campusId) {
      const campus = await ctx.db.get(args.campusId);

      if (!campus || campus.tenantId !== tenant._id) {
        throw new Error("Campus not found");
      }
    }

    const code = args.code.trim().toUpperCase();
    const name = args.name.trim();

    if (!code) {
      throw new Error("Room code is required");
    }

    if (!name) {
      throw new Error("Room name is required");
    }

    if (args.capacity < 0) {
      throw new Error("Room capacity cannot be negative");
    }

    const duplicate = await ctx.db
      .query("rooms")
      .withIndex("by_tenant_code", (q) =>
        q.eq("tenantId", tenant._id).eq("code", code)
      )
      .unique();

    if (duplicate && duplicate._id !== args.roomId) {
      throw new Error("A room with this code already exists");
    }

    const payload = {
      tenantId: tenant._id,
      campusId: args.campusId ?? roomType.campusId,
      roomTypeId: args.roomTypeId,
      code,
      name,
      description: args.description?.trim() || undefined,
      capacity: args.capacity,
      imageStorageId: args.imageStorageId,
      active: args.active,
      updatedAt: now,
    };

    if (args.roomId) {
      const room = await ctx.db.get(args.roomId);

      if (!room || room.tenantId !== tenant._id) {
        throw new Error("Room not found");
      }

      await ctx.db.patch(args.roomId, payload);
      return args.roomId;
    }

    return await ctx.db.insert("rooms", {
      ...payload,
      createdAt: now,
    });
  },
});

export const deleteRoom = mutation({
  args: {
    tenantSlug: v.string(),
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireAdmin(ctx, args.tenantSlug);
    const room = await ctx.db.get(args.roomId);

    if (!room || room.tenantId !== tenant._id) {
      throw new Error("Room not found");
    }

    const bookings = await ctx.db
      .query("bookingRequests")
      .withIndex("by_tenant_created", (q) => q.eq("tenantId", tenant._id))
      .collect();

    const isUsedInBooking = bookings.some(
      (booking) =>
        booking.assignedRoomIds.includes(args.roomId) ||
        booking.requestedRoomIds?.includes(args.roomId)
    );

    if (isUsedInBooking) {
      await ctx.db.patch(args.roomId, {
        active: false,
        updatedAt: Date.now(),
      });

      return args.roomId;
    }

    await ctx.db.delete(args.roomId);
    return args.roomId;
  },
});

/**
 * Form config
 */

export const getFormConfig = query({
  args: { tenantSlug: v.string() },
  handler: async (ctx, args) => {
    const tenant = await tenantBySlug(ctx, args.tenantSlug);
    if (!tenant) return null;

    return await ctx.db
      .query("formConfigs")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .first();
  },
});

export const getPrivateFormConfig = query({
  args: { tenantSlug: v.string() },
  handler: async (ctx, args) => {
    const { tenant } = await requireStaff(ctx, args.tenantSlug);

    return await ctx.db
      .query("formConfigs")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .first();
  },
});

const formFieldValidator = v.object({
  id: v.string(),
  label: v.string(),
  type: v.union(
    v.literal("text"),
    v.literal("number"),
    v.literal("textarea"),
    v.literal("radio"),
    v.literal("select"),
    v.literal("divider"),
    v.literal("note"),
    v.literal("checkboxGroup")
  ),
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

    const existing = await ctx.db
      .query("formConfigs")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .first();

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

/**
 * Users
 */

export const listUsers = query({
  args: { tenantSlug: v.string() },
  handler: async (ctx, args) => {
    const { tenant } = await requireAdmin(ctx, args.tenantSlug);

    return await ctx.db
      .query("users")
      .withIndex("by_tenant_role", (q) => q.eq("tenantId", tenant._id))
      .collect();
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

export const upsertUser = mutation({
  args: {
    tenantSlug: v.string(),
    userId: v.optional(v.id("users")),
    name: v.string(),
    email: v.string(),
    role: v.union(
      v.literal("Admin"),
      v.literal("Staff"),
      v.literal("Requester")
    ),
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

      if (!user || user.tenantId !== tenant._id) {
        throw new Error("User not found");
      }

      await ctx.db.patch(args.userId, payload);
      return args.userId;
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_tenant_email", (q) =>
        q.eq("tenantId", tenant._id).eq("email", email)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("users", payload);
  },
});

export const deleteUser = mutation({
  args: {
    tenantSlug: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireAdmin(ctx, args.tenantSlug);
    const user = await ctx.db.get(args.userId);

    if (!user || user.tenantId !== tenant._id) {
      throw new Error("User not found");
    }

    await ctx.db.delete(args.userId);
  },
});

