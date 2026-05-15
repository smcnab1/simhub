import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { authContextValidator, membershipsForAuth, requireAdmin, requireStaff, tenantBySlug } from "./authz";
import {
  campusIsActive,
  normalizeCampusName,
  normalizeCampusText,
  sortCampuses,
  validateCampusSortOrder,
} from "../src/lib/campus";

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

async function roomImageUrl(ctx: QueryCtx, imageStorageId?: Id<"_storage">) {
  return imageStorageId ? await ctx.storage.getUrl(imageStorageId) : null;
}

function normalizeRoomType(roomType: Doc<"roomTypes">) {
  const maxBookingDurationMinutes =
    roomType.maxBookingDurationMinutes ??
    (roomType.maxDurationHours !== undefined
      ? roomType.maxDurationHours * 60
      : undefined);

  return {
    ...roomType,
    maxBookingDurationMinutes,
    specialRoom: roomType.specialRoom ?? roomType.isSpecial ?? false,
  };
}

async function campusIsPubliclySelectable(
  ctx: QueryCtx,
  campusId?: Id<"campuses">
) {
  if (!campusId) {
    return true;
  }

  const campus = await ctx.db.get(campusId);
  return !!campus && campusIsActive(campus);
}

async function roomTypeIsPubliclySelectable(
  ctx: QueryCtx,
  roomType: Doc<"roomTypes">
) {
  if (!roomType.active) {
    return false;
  }

  return await campusIsPubliclySelectable(ctx, roomType.campusId);
}

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) =>
    ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique(),
});

export const listMembershipsForAuth = query({
  args: { auth: authContextValidator },
  handler: async (ctx, args) => {
    const memberships = await membershipsForAuth(ctx, args.auth);

    return memberships
      .map(({ tenant, user }) => ({
        tenantId: tenant._id,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        workosOrganizationId: tenant.workosOrganizationId,
        userId: user._id,
        role: user.role,
      }))
      .sort((a, b) => a.tenantName.localeCompare(b.tenantName));
  },
});

export const getPrivateTenant = query({
  args: { tenantSlug: v.string(), auth: authContextValidator },
  handler: async (ctx, args) => {
    const { tenant } = await requireAdmin(ctx, args.tenantSlug, args.auth);
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

    return sortCampuses(campuses.filter(campusIsActive));
  },
});

export const listPrivateCampuses = query({
  args: {
    tenantSlug: v.string(),
    auth: authContextValidator,
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireStaff(ctx, args.tenantSlug, args.auth);

    const campuses = await ctx.db
      .query("campuses")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .collect();

    const filtered =
      args.activeOnly === false ? campuses : campuses.filter(campusIsActive);

    return sortCampuses(filtered);
  },
});

export const listAdminCampuses = query({
  args: {
    tenantSlug: v.string(),
    auth: authContextValidator,
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireAdmin(ctx, args.tenantSlug, args.auth);

    const campuses = await ctx.db
      .query("campuses")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .collect();

    const filtered =
      args.activeOnly === false ? campuses : campuses.filter(campusIsActive);

    return sortCampuses(filtered);
  },
});

export const upsertCampus = mutation({
  args: {
    tenantSlug: v.string(),
    auth: authContextValidator,
    campusId: v.optional(v.id("campuses")),
    name: v.string(),
    addressLine1: v.optional(v.string()),
    addressLine2: v.optional(v.string()),
    city: v.optional(v.string()),
    region: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    country: v.optional(v.string()),
    details: v.optional(v.string()),
    active: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireAdmin(ctx, args.tenantSlug, args.auth);
    const now = Date.now();

    const name = normalizeCampusName(args.name);

    if (!name) {
      throw new Error("Campus name is required.");
    }

    const sortOrderError = validateCampusSortOrder(args.sortOrder);

    if (sortOrderError) {
      throw new Error(sortOrderError);
    }

    const existingCampuses = await ctx.db
      .query("campuses")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .collect();

    const duplicate = existingCampuses.find(
      (campus) =>
        campus._id !== args.campusId &&
        campus.name.trim().toLowerCase() === name.toLowerCase()
    );

    if (duplicate) {
      throw new Error("A campus with this name already exists.");
    }

    const payload = {
      tenantId: tenant._id,
      name,
      addressLine1: normalizeCampusText(args.addressLine1),
      addressLine2: normalizeCampusText(args.addressLine2),
      city: normalizeCampusText(args.city),
      region: normalizeCampusText(args.region),
      postalCode: normalizeCampusText(args.postalCode),
      country: normalizeCampusText(args.country),
      details: normalizeCampusText(args.details),
      active: args.active ?? true,
      sortOrder: args.sortOrder,
      updatedAt: now,
      archivedAt: args.active === false ? now : undefined,
    };

    if (args.campusId) {
      const campus = await ctx.db.get(args.campusId);

      if (!campus || campus.tenantId !== tenant._id) {
        throw new Error("Campus not found");
      }

      await ctx.db.patch(args.campusId, payload);
      return args.campusId;
    }

    return await ctx.db.insert("campuses", {
      ...payload,
      createdAt: now,
    });
  },
});

export const reorderCampuses = mutation({
  args: {
    tenantSlug: v.string(),
    auth: authContextValidator,
    campusIds: v.array(v.id("campuses")),
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireAdmin(ctx, args.tenantSlug, args.auth);
    const uniqueCampusIds = new Set(args.campusIds);

    if (uniqueCampusIds.size !== args.campusIds.length) {
      throw new Error("Campus order contains a duplicate campus.");
    }

    const campuses = await ctx.db
      .query("campuses")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .collect();

    const tenantCampusIds = new Set(campuses.map((campus) => campus._id));

    for (const campusId of args.campusIds) {
      if (!tenantCampusIds.has(campusId)) {
        throw new Error("Campus not found.");
      }
    }

    const now = Date.now();

    await Promise.all(
      args.campusIds.map((campusId, index) =>
        ctx.db.patch(campusId, {
          sortOrder: (index + 1) * 10,
          updatedAt: now,
        })
      )
    );

    return args.campusIds.length;
  },
});

export const deleteCampus = mutation({
  args: {
    tenantSlug: v.string(),
    auth: authContextValidator,
    campusId: v.id("campuses"),
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireAdmin(ctx, args.tenantSlug, args.auth);
    const campus = await ctx.db.get(args.campusId);

    if (!campus || campus.tenantId !== tenant._id) {
      throw new Error("Campus not found");
    }

    await ctx.db.patch(args.campusId, {
      active: false,
      archivedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return args.campusId;
  },
});

export const backfillCampusManagementFields = mutation({
  args: {
    tenantSlug: v.string(),
    auth: authContextValidator,
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireAdmin(ctx, args.tenantSlug, args.auth);
    const campuses = sortCampuses(
      await ctx.db
        .query("campuses")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
        .collect()
    );

    let updated = 0;
    const now = Date.now();

    for (const [index, campus] of campuses.entries()) {
      const patch: {
        active?: boolean;
        sortOrder?: number;
        updatedAt: number;
      } = {
        updatedAt: now,
      };

      if (campus.active === undefined) {
        patch.active = true;
      }

      if (campus.sortOrder === undefined) {
        patch.sortOrder = (index + 1) * 10;
      }

      if (Object.keys(patch).length > 1) {
        await ctx.db.patch(campus._id, patch);
        updated += 1;
      }
    }

    return { updated };
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

    const selectableRoomTypes = (
      await Promise.all(
        roomTypes.map(async (roomType) =>
          (await roomTypeIsPubliclySelectable(ctx, roomType)) ? roomType : null
        )
      )
    ).filter((roomType): roomType is Doc<"roomTypes"> => roomType !== null);

    const enriched = await Promise.all(
      selectableRoomTypes.map(async (roomType) => {
          const counts = await getRoomCountForRoomType(
            ctx,
            tenant._id,
            roomType._id
          );

          const campus = roomType.campusId
            ? await ctx.db.get(roomType.campusId)
            : null;

          return {
            ...normalizeRoomType(roomType),
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
    auth: authContextValidator,
    campusId: v.optional(v.id("campuses")),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireStaff(ctx, args.tenantSlug, args.auth);

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
          ...normalizeRoomType(roomType),
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

export const listAdminRoomTypes = query({
  args: {
    tenantSlug: v.string(),
    auth: authContextValidator,
    campusId: v.optional(v.id("campuses")),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireAdmin(ctx, args.tenantSlug, args.auth);

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
          ...normalizeRoomType(roomType),
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
    auth: authContextValidator,
    roomTypeId: v.optional(v.id("roomTypes")),
    campusId: v.optional(v.id("campuses")),
    name: v.string(),
    description: v.optional(v.string()),
    defaultCapacity: v.number(),
    maxBookingDurationMinutes: v.optional(v.number()),
    specialRoom: v.boolean(),
    active: v.boolean(),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireAdmin(ctx, args.tenantSlug, args.auth);
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

    if (!Number.isInteger(args.defaultCapacity) || args.defaultCapacity < 0) {
      throw new Error("Default capacity must be a whole number greater than or equal to zero");
    }

    if (
      args.maxBookingDurationMinutes !== undefined &&
      (!Number.isInteger(args.maxBookingDurationMinutes) ||
        args.maxBookingDurationMinutes <= 0)
    ) {
      throw new Error("Maximum booking duration must be a whole number greater than zero");
    }

    if (args.sortOrder !== undefined && !Number.isInteger(args.sortOrder)) {
      throw new Error("Sort order must be a whole number");
    }

    const existingRoomTypes = await ctx.db
      .query("roomTypes")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .collect();

    const duplicate = existingRoomTypes.find(
      (roomType) =>
        roomType._id !== args.roomTypeId &&
        roomType.name.trim().toLowerCase() === name.toLowerCase() &&
        roomType.campusId === args.campusId
    );

    if (duplicate) {
      throw new Error("A room type with this name already exists for this campus scope");
    }

    const payload = {
      tenantId: tenant._id,
      campusId: args.campusId,
      name,
      description: args.description?.trim() || undefined,
      defaultCapacity: args.defaultCapacity,
      maxBookingDurationMinutes: args.maxBookingDurationMinutes,
      specialRoom: args.specialRoom,
      maxDurationHours: undefined,
      isSpecial: undefined,
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
    auth: authContextValidator,
    roomTypeId: v.id("roomTypes"),
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireAdmin(ctx, args.tenantSlug, args.auth);
    const roomType = await ctx.db.get(args.roomTypeId);

    if (!roomType || roomType.tenantId !== tenant._id) {
      throw new Error("Room type not found");
    }

    await ctx.db.patch(args.roomTypeId, {
      active: false,
      updatedAt: Date.now(),
    });

    return args.roomTypeId;
  },
});

export const backfillRoomTypeManagementFields = mutation({
  args: {
    tenantSlug: v.string(),
    auth: authContextValidator,
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireAdmin(ctx, args.tenantSlug, args.auth);
    const roomTypes = await ctx.db
      .query("roomTypes")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .collect();

    let updated = 0;

    for (const roomType of roomTypes) {
      const patch: {
        maxBookingDurationMinutes?: number;
        specialRoom?: boolean;
        maxDurationHours?: undefined;
        isSpecial?: undefined;
        updatedAt: number;
      } = {
        updatedAt: Date.now(),
      };

      if (
        roomType.maxBookingDurationMinutes === undefined &&
        roomType.maxDurationHours !== undefined
      ) {
        patch.maxBookingDurationMinutes = roomType.maxDurationHours * 60;
      }

      if (roomType.specialRoom === undefined) {
        patch.specialRoom = roomType.isSpecial ?? false;
      }

      if (roomType.maxDurationHours !== undefined) {
        patch.maxDurationHours = undefined;
      }

      if (roomType.isSpecial !== undefined) {
        patch.isSpecial = undefined;
      }

      if (Object.keys(patch).length > 1) {
        await ctx.db.patch(roomType._id, patch);
        updated += 1;
      }
    }

    return { updated };
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

    const filtered = args.activeOnly === false
      ? rooms
      : (
          await Promise.all(
            rooms.map(async (room) =>
              room.active && (await campusIsPubliclySelectable(ctx, room.campusId))
                ? room
                : null
            )
          )
        ).filter((room): room is Doc<"rooms"> => room !== null);

    const enriched = await Promise.all(
      filtered.map(async (room) => {
        const [roomType, campus] = await Promise.all([
          ctx.db.get(room.roomTypeId),
          room.campusId ? ctx.db.get(room.campusId) : Promise.resolve(null),
        ]);

        return {
          ...room,
          roomType: roomType ? normalizeRoomType(roomType) : null,
          campus,
          imageUrl: await roomImageUrl(ctx, room.imageStorageId),
        };
      })
    );

    return enriched.sort((a, b) => a.code.localeCompare(b.code));
  },
});

export const listPrivateRooms = query({
  args: {
    tenantSlug: v.string(),
    auth: authContextValidator,
    campusId: v.optional(v.id("campuses")),
    roomTypeId: v.optional(v.id("roomTypes")),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireStaff(ctx, args.tenantSlug, args.auth);

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
          roomType: roomType ? normalizeRoomType(roomType) : null,
          campus,
          imageUrl: await roomImageUrl(ctx, room.imageStorageId),
        };
      })
    );

    return enriched.sort((a, b) => a.code.localeCompare(b.code));
  },
});

export const upsertRoom = mutation({
  args: {
    tenantSlug: v.string(),
    auth: authContextValidator,
    roomId: v.optional(v.id("rooms")),
    campusId: v.optional(v.id("campuses")),
    roomTypeId: v.id("roomTypes"),
    code: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    capacity: v.number(),
    imageStorageId: v.optional(v.id("_storage")),
    removeImage: v.optional(v.boolean()),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireAdmin(ctx, args.tenantSlug, args.auth);
    const now = Date.now();

    const roomType = await ctx.db.get(args.roomTypeId);

    if (!roomType || roomType.tenantId !== tenant._id) {
      throw new Error("Room type not found");
    }

    const existingRoom = args.roomId ? await ctx.db.get(args.roomId) : null;

    if (args.roomId && (!existingRoom || existingRoom.tenantId !== tenant._id)) {
      throw new Error("Room not found");
    }

    if (!roomType.active && existingRoom?.roomTypeId !== args.roomTypeId) {
      throw new Error("Inactive room types cannot be assigned to new rooms");
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

    if (!Number.isFinite(args.capacity) || args.capacity < 0) {
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

    const payload: {
      tenantId: Id<"tenants">;
      campusId: Id<"campuses"> | undefined;
      roomTypeId: Id<"roomTypes">;
      code: string;
      name: string;
      description?: string;
      capacity: number;
      active: boolean;
      updatedAt: number;
      imageStorageId?: Id<"_storage"> | undefined;
    } = {
      tenantId: tenant._id,
      campusId: args.campusId ?? roomType.campusId,
      roomTypeId: args.roomTypeId,
      code,
      name,
      description: args.description?.trim() || undefined,
      capacity: args.capacity,
      active: args.active,
      updatedAt: now,
    };

    if (args.roomId) {
      if (args.removeImage) {
        payload.imageStorageId = undefined;
      } else if (args.imageStorageId) {
        payload.imageStorageId = args.imageStorageId;
      } else if (existingRoom?.imageStorageId) {
        payload.imageStorageId = existingRoom.imageStorageId;
      }

      await ctx.db.patch(args.roomId, payload);
      return args.roomId;
    }

    if (args.imageStorageId) {
      payload.imageStorageId = args.imageStorageId;
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
    auth: authContextValidator,
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireAdmin(ctx, args.tenantSlug, args.auth);
    const room = await ctx.db.get(args.roomId);

    if (!room || room.tenantId !== tenant._id) {
      throw new Error("Room not found");
    }

    await ctx.db.patch(args.roomId, {
      active: false,
      updatedAt: Date.now(),
    });

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
  args: { tenantSlug: v.string(), auth: authContextValidator },
  handler: async (ctx, args) => {
    const { tenant } = await requireAdmin(ctx, args.tenantSlug, args.auth);

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
    auth: authContextValidator,
    fileUploadEnabled: v.boolean(),
    fields: v.array(formFieldValidator),
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireAdmin(ctx, args.tenantSlug, args.auth);

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
  args: { tenantSlug: v.string(), auth: authContextValidator },
  handler: async (ctx, args) => {
    const { tenant } = await requireAdmin(ctx, args.tenantSlug, args.auth);

    return await ctx.db
      .query("users")
      .withIndex("by_tenant_role", (q) => q.eq("tenantId", tenant._id))
      .collect();
  },
});

export const upsertFacilityDetails = mutation({
  args: {
    tenantSlug: v.string(),
    auth: authContextValidator,
    name: v.string(),
    contactEmail: v.string(),
    notificationEmails: v.array(v.string()),
    hoursOfOperation: v.string(),
    uploadMaxBytes: v.number(),
    logoStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireAdmin(ctx, args.tenantSlug, args.auth);

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
    auth: authContextValidator,
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
    const { tenant } = await requireAdmin(ctx, args.tenantSlug, args.auth);
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

      if (user.role === "Developer") {
        throw new Error("Developer users can only be managed by bootstrap tooling");
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
    auth: authContextValidator,
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireAdmin(ctx, args.tenantSlug, args.auth);
    const user = await ctx.db.get(args.userId);

    if (!user || user.tenantId !== tenant._id) {
      throw new Error("User not found");
    }

    if (user.role === "Developer") {
      throw new Error("Developer users can only be managed by bootstrap tooling");
    }

    await ctx.db.delete(args.userId);
  },
});
