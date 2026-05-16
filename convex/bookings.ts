import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  authContextValidator,
  requireStaff,
  requireTenantAccess,
  tenantBySlug,
  type ConvexAuthContext,
} from "./authz";
import {
  allocateRoomsByType,
  checkAvailabilityConflicts,
  evaluateBookingNoticeWindow,
  hasBookingConflict,
  bookingBlocksFromSessionWindow,
  roomTypeBufferMinutes,
  sessionBookingRange,
  validateBookingBlocks,
  validateBookingWithinStaffHours,
  validateSessionWithinOpeningHours,
  validateRoomSelectionState,
  validateMaxBookingDuration,
  type AvailabilityCheckResult,
  type BookingNoticeEvaluation,
} from "../src/lib/booking-logic";
import { campusIsActive } from "../src/lib/campus";

async function withAssignedRooms(ctx: QueryCtx, request: Doc<"bookingRequests">) {
  const rooms = await Promise.all(request.assignedRoomIds.map((roomId: Id<"rooms">) => ctx.db.get(roomId)));
  const assignedRooms = rooms.filter((room): room is Doc<"rooms"> => room !== null);
  const requestedRooms = await Promise.all(
    (request.requestedRoomIds ?? []).map((roomId) => ctx.db.get(roomId))
  );
  const roomTypeRequestDetails = await Promise.all(
    request.roomTypeRequests.map(async (roomTypeRequest) => {
      const roomType = await ctx.db.get(roomTypeRequest.roomTypeId);

      return {
        ...roomTypeRequest,
        roomTypeName: roomType?.name ?? "Unknown room type",
        defaultCapacity: roomType?.defaultCapacity ?? 0,
      };
    })
  );

  return {
    ...request,
    assignedRooms: assignedRooms.map((room) => ({ _id: room._id, code: room.code, name: room.name })),
    requestedRooms: requestedRooms
      .filter((room): room is Doc<"rooms"> => room !== null)
      .map((room) => ({
        _id: room._id,
        code: room.code,
        name: room.name,
        capacity: room.capacity,
      })),
    roomTypeRequestDetails,
  };
}

function bookingEndsInFuture(request: Doc<"bookingRequests">) {
  const latestEnd = Math.max(...request.blocks.map((block) => Date.parse(block.end)));
  return Number.isFinite(latestEnd) && latestEnd > Date.now();
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function formatDateTimeForNotification(value: string, timezone: string) {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(date);
}

function formatTimeForNotification(value: string, timezone: string) {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: timezone,
  }).format(date);
}

function formatRequestWindow(blocks: Array<{ start: string; end: string }>, timezone: string) {
  const starts = blocks.map((block) => Date.parse(block.start));
  const ends = blocks.map((block) => Date.parse(block.end));
  const earliestStart = Math.min(...starts);
  const latestEnd = Math.max(...ends);

  if (!Number.isFinite(earliestStart) || !Number.isFinite(latestEnd)) {
    return "invalid requested time";
  }

  return `${formatDateTimeForNotification(new Date(earliestStart).toISOString(), timezone)} to ${formatTimeForNotification(new Date(latestEnd).toISOString(), timezone)}`;
}

async function requesterUserByEmail(
  ctx: QueryCtx | MutationCtx,
  tenantId: Id<"tenants">,
  email: string
) {
  const normalizedEmail = normalizeEmail(email);
  const exact = await ctx.db
    .query("users")
    .withIndex("by_tenant_email", (q) =>
      q.eq("tenantId", tenantId).eq("email", normalizedEmail)
    )
    .unique();

  if (exact) return exact;

  const users = await ctx.db
    .query("users")
    .withIndex("by_tenant_role", (q) =>
      q.eq("tenantId", tenantId).eq("role", "Requester")
    )
    .collect();

  return users.find((user) => normalizeEmail(user.email) === normalizedEmail) ?? null;
}

async function validateCustomInputs(
  ctx: QueryCtx | MutationCtx,
  tenantId: Id<"tenants">,
  customInputs: Array<{ fieldId: string; label: string; value: unknown }>
) {
  const formConfig = await ctx.db
    .query("formConfigs")
    .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
    .unique();

  if (!formConfig) return;

  const inputByFieldId = new Map(customInputs.map((input) => [input.fieldId, input]));

  for (const field of formConfig.fields) {
    if (field.type === "divider" || field.type === "note") {
      continue;
    }

    const input = inputByFieldId.get(field.id);
    const value = input?.value;
    const missing =
      value === null ||
      value === undefined ||
      (typeof value === "string" && value.trim() === "") ||
      (Array.isArray(value) && value.length === 0);

    if (field.required && missing) {
      throw new Error(`${field.label} is required.`);
    }

    if (missing) {
      continue;
    }

    if ((field.type === "text" || field.type === "textarea") && field.maxLength) {
      if (typeof value !== "string" || value.length > field.maxLength) {
        throw new Error(`${field.label} must be ${field.maxLength} characters or fewer.`);
      }
    }

    if (field.type === "number" && Number.isNaN(Number(value))) {
      throw new Error(`${field.label} must be a number.`);
    }

    if (field.type === "radio" || field.type === "select") {
      if (typeof value !== "string" || !(field.options ?? []).includes(value)) {
        throw new Error(`${field.label} has an invalid option.`);
      }
    }

    if (field.type === "checkboxGroup") {
      const values = Array.isArray(value) ? value : [];
      if (
        values.some(
          (item) => typeof item !== "string" || !(field.options ?? []).includes(item)
        )
      ) {
        throw new Error(`${field.label} has an invalid option.`);
      }
    }
  }
}

function validateRequesterDetails(args: {
  requesterName: string;
  requesterEmail: string;
  sessionName: string;
  attendeeCount: number;
  details: string;
  ccEmails: string[];
}) {
  if (!args.requesterName.trim()) {
    return "Requester name is required.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.requesterEmail.trim())) {
    return "A valid requester email is required.";
  }

  if (!args.sessionName.trim()) {
    return "Session name is required.";
  }

  if (!Number.isInteger(args.attendeeCount) || args.attendeeCount < 1) {
    return "Attendee count must be a whole number greater than zero.";
  }

  if (!args.details.trim()) {
    return "Session details are required.";
  }

  if (args.ccEmails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return "CC emails must be valid email addresses.";
  }

  return null;
}

function publicRoomType(roomType: Doc<"roomTypes">) {
  return {
    id: roomType._id,
    name: roomType.name,
    campusId: roomType.campusId,
    active: roomType.active,
    maxBookingDurationMinutes:
      roomType.maxBookingDurationMinutes ??
      (roomType.maxDurationHours !== undefined
        ? roomType.maxDurationHours * 60
        : undefined),
    standardSetupMinutes: roomType.standardSetupMinutes ?? 30,
    standardCleanupMinutes: roomType.standardCleanupMinutes ?? 30,
  };
}

function tenantBookingNoticeRules(tenant: Doc<"tenants">) {
  return {
    minimumAdvanceBookingDays: tenant.minimumAdvanceBookingDays,
    maximumAdvanceBookingDays: tenant.maximumAdvanceBookingDays,
    violationMode: tenant.bookingNoticeViolationMode ?? "Block",
  };
}

function authCanOverrideBookingNotice(role?: string) {
  return role === "Developer" || role === "Admin" || role === "Staff";
}

async function verifiedBookingNoticeOverrideRole(
  ctx: QueryCtx | MutationCtx,
  tenantSlug: string,
  auth?: ConvexAuthContext
) {
  if (!authCanOverrideBookingNotice(auth?.role)) {
    return undefined;
  }

  try {
    const { user } = await requireStaff(ctx, tenantSlug, auth);
    return authCanOverrideBookingNotice(user?.role) ? user?.role : undefined;
  } catch {
    return undefined;
  }
}

function availabilityWithNoticeEvaluation(
  availability: AvailabilityCheckResult,
  notice: BookingNoticeEvaluation
): AvailabilityCheckResult {
  if (notice.violations.length === 0) {
    return availability;
  }

  const noticeConflicts = notice.violations.map((violation) => ({
    type: "booking_notice" as const,
    severity: notice.canSubmit ? ("warning" as const) : ("likely_unavailable" as const),
    message: notice.canSubmit
      ? `${violation.message} Your request will require additional approval.`
      : violation.message,
  }));
  const conflicts = [...availability.conflicts, ...noticeConflicts];
  const highestSeverity =
    notice.canSubmit && availability.highestSeverity !== "likely_unavailable"
      ? availability.highestSeverity ?? "warning"
      : "likely_unavailable";

  return {
    ...availability,
    canSubmit: availability.canSubmit && notice.canSubmit,
    highestSeverity,
    summary: notice.canSubmit
      ? "This request will require additional approval."
      : notice.violations[0]?.message ?? availability.summary,
    conflicts,
  };
}

async function computeAvailability(
  ctx: QueryCtx | MutationCtx,
  tenantId: Id<"tenants">,
  args: {
    roomSelectionMode?: "SpecificRooms" | "RoomTypeQuantity";
    blocks: Array<{ start: string; end: string }>;
    roomTypeRequests: Array<{ roomTypeId: Id<"roomTypes">; quantity: number }>;
    requestedRoomIds?: Id<"rooms">[];
    excludeRequestId?: Id<"bookingRequests">;
  }
): Promise<AvailabilityCheckResult> {
  const [rooms, roomTypes, campuses, approved, pending, blockedTimes] =
    await Promise.all([
      ctx.db
        .query("rooms")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .collect(),
      ctx.db
        .query("roomTypes")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .collect(),
      ctx.db
        .query("campuses")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .collect(),
      ctx.db
        .query("bookingRequests")
        .withIndex("by_tenant_status", (q) =>
          q.eq("tenantId", tenantId).eq("status", "Approved")
        )
        .collect(),
      ctx.db
        .query("bookingRequests")
        .withIndex("by_tenant_status", (q) =>
          q.eq("tenantId", tenantId).eq("status", "Pending")
        )
        .collect(),
      ctx.db
        .query("blockedTimes")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .collect(),
    ]);

  const activeCampusIds = new Set(
    campuses.filter(campusIsActive).map((campus) => campus._id)
  );
  const selectedRooms = args.requestedRoomIds
    ? rooms.filter((room) => args.requestedRoomIds?.includes(room._id))
    : [];
  const availabilityRoomTypeRequests =
    args.roomSelectionMode === "SpecificRooms"
      ? Object.entries(
          selectedRooms.reduce<Record<string, number>>((counts, room) => {
            counts[room.roomTypeId] = (counts[room.roomTypeId] ?? 0) + 1;
            return counts;
          }, {})
        ).map(([roomTypeId, quantity]) => ({ roomTypeId, quantity }))
      : args.roomTypeRequests;
  const selectableRooms = rooms.filter(
    (room) => room.active && (!room.campusId || activeCampusIds.has(room.campusId))
  );
  const selectableRoomTypes = roomTypes.filter(
    (roomType) =>
      roomType.active && (!roomType.campusId || activeCampusIds.has(roomType.campusId))
  );
  const visibleBookings = [...approved, ...pending].filter(
    (request) => request._id !== args.excludeRequestId
  );

  return checkAvailabilityConflicts({
    roomSelectionMode: args.roomSelectionMode,
    blocks: args.blocks,
    roomTypeRequests: availabilityRoomTypeRequests,
    requestedRoomIds: args.requestedRoomIds,
    rooms: selectableRooms.map((room) => ({
      id: room._id,
      code: room.code,
      name: room.name,
      roomTypeId: room.roomTypeId,
      campusId: room.campusId,
      active: room.active,
    })),
    roomTypes: selectableRoomTypes.map(publicRoomType),
    campuses: campuses.map((campus) => ({
      id: campus._id,
      name: campus.name,
      active: campusIsActive(campus),
    })),
    bookings: visibleBookings.map((request) => ({
      id: request._id,
      status: request.status,
      blocks: request.blocks,
      assignedRoomIds: request.assignedRoomIds,
      requestedRoomIds: request.requestedRoomIds,
      roomTypeRequests: request.roomTypeRequests,
    })),
    blockedTimes: blockedTimes.map((blockedTime) => ({
      id: blockedTime._id,
      roomId: blockedTime.roomId,
      roomTypeId: blockedTime.roomTypeId,
      campusId: blockedTime.campusId,
      start: blockedTime.start,
      end: blockedTime.end,
      reason: blockedTime.reason,
    })),
  });
}

async function validateSpecificRoomRequests(
  ctx: QueryCtx | MutationCtx,
  tenantId: Id<"tenants">,
  blocks: Array<{ start: string; end: string }>,
  requestedRoomIds: Id<"rooms">[]
) {
  const uniqueRoomIds = new Set(requestedRoomIds);

  if (uniqueRoomIds.size !== requestedRoomIds.length) {
    throw new Error("The same room cannot be requested more than once.");
  }

  const rooms = await Promise.all(requestedRoomIds.map((roomId) => ctx.db.get(roomId)));
  const roomTypeCounts = new Map<Id<"roomTypes">, number>();

  for (const room of rooms) {
    if (!room || room.tenantId !== tenantId || !room.active) {
      throw new Error("Selected room is no longer available.");
    }

    if (room.campusId) {
      const campus = await ctx.db.get(room.campusId);

      if (!campus || campus.tenantId !== tenantId || !campusIsActive(campus)) {
        throw new Error(`${room.name} (${room.code}) belongs to an inactive campus and cannot be requested.`);
      }
    }

    roomTypeCounts.set(room.roomTypeId, (roomTypeCounts.get(room.roomTypeId) ?? 0) + 1);
  }

  const selectedRoomTypes = await Promise.all(
    Array.from(roomTypeCounts.keys()).map(async (roomTypeId) => {
      const roomType = await ctx.db.get(roomTypeId);

      if (!roomType || roomType.tenantId !== tenantId || !roomType.active) {
        throw new Error("Selected room type is no longer available.");
      }

      return {
        id: roomType._id,
        name: roomType.name,
        maxBookingDurationMinutes:
          roomType.maxBookingDurationMinutes ??
          (roomType.maxDurationHours !== undefined
            ? roomType.maxDurationHours * 60
            : undefined),
        standardSetupMinutes: roomType.standardSetupMinutes ?? 30,
        standardCleanupMinutes: roomType.standardCleanupMinutes ?? 30,
      };
    })
  );
  const durationError = validateMaxBookingDuration(
    blocks,
    Array.from(roomTypeCounts.entries()).map(([roomTypeId, quantity]) => ({
      roomTypeId,
      quantity,
    })),
    selectedRoomTypes
  );

  if (durationError) {
    throw new Error(durationError);
  }
}

async function validateRequesterRoomSelection(
  ctx: QueryCtx | MutationCtx,
  tenantId: Id<"tenants">,
  args: {
    roomSelectionMode: "SpecificRooms" | "RoomTypeQuantity";
    blocks: Array<{ start: string; end: string }>;
    requestedRoomIds?: Id<"rooms">[];
    roomTypeRequests: Array<{ roomTypeId: Id<"roomTypes">; quantity: number }>;
  }
) {
  const selectionError = validateRoomSelectionState({
    roomSelectionMode: args.roomSelectionMode,
    requestedRoomIds: args.requestedRoomIds ?? [],
    roomTypeRequests: args.roomTypeRequests,
  });

  if (selectionError) {
    throw new Error(selectionError);
  }

  if (args.roomSelectionMode === "SpecificRooms") {
    await validateSpecificRoomRequests(
      ctx,
      tenantId,
      args.blocks,
      args.requestedRoomIds ?? []
    );
    return;
  }

  await validateRoomTypeRequests(
    ctx,
    tenantId,
    args.blocks,
    args.roomTypeRequests
  );
}

async function roomTypeRequestsForSelection(
  ctx: QueryCtx | MutationCtx,
  tenantId: Id<"tenants">,
  args: {
    roomSelectionMode: "SpecificRooms" | "RoomTypeQuantity";
    requestedRoomIds?: Id<"rooms">[];
    roomTypeRequests: Array<{ roomTypeId: Id<"roomTypes">; quantity: number }>;
  }
) {
  if (args.roomSelectionMode === "RoomTypeQuantity") {
    return args.roomTypeRequests;
  }

  const requestedRooms = await Promise.all(
    (args.requestedRoomIds ?? []).map((roomId) => ctx.db.get(roomId))
  );
  const counts = new Map<Id<"roomTypes">, number>();

  for (const room of requestedRooms) {
    if (!room || room.tenantId !== tenantId) continue;
    counts.set(room.roomTypeId, (counts.get(room.roomTypeId) ?? 0) + 1);
  }

  return Array.from(counts.entries()).map(([roomTypeId, quantity]) => ({
    roomTypeId,
    quantity,
  }));
}

async function roomTypeRulesForRequests(
  ctx: QueryCtx | MutationCtx,
  tenantId: Id<"tenants">,
  roomTypeRequests: Array<{ roomTypeId: Id<"roomTypes">; quantity: number }>
) {
  return (
    await Promise.all(
      roomTypeRequests.map(async (request) => {
        const roomType = await ctx.db.get(request.roomTypeId);

        if (!roomType || roomType.tenantId !== tenantId) return null;

        return {
          id: roomType._id,
          name: roomType.name,
          maxBookingDurationMinutes:
            roomType.maxBookingDurationMinutes ??
            (roomType.maxDurationHours !== undefined
              ? roomType.maxDurationHours * 60
              : undefined),
          standardSetupMinutes: roomType.standardSetupMinutes ?? 30,
          standardCleanupMinutes: roomType.standardCleanupMinutes ?? 30,
        };
      })
    )
  ).filter((roomType): roomType is NonNullable<typeof roomType> => roomType !== null);
}

async function deriveBufferedBlocks(
  ctx: QueryCtx | MutationCtx,
  tenantId: Id<"tenants">,
  args: {
    roomSelectionMode: "SpecificRooms" | "RoomTypeQuantity";
    requestedRoomIds?: Id<"rooms">[];
    roomTypeRequests: Array<{ roomTypeId: Id<"roomTypes">; quantity: number }>;
    blocks: Array<{ label: "Setup" | "Session" | "Cleanup"; start: string; end: string }>;
  }
) {
  const sessionBlock = args.blocks.find((block) => block.label === "Session");

  if (!sessionBlock) {
    throw new Error("Session start and finish are required.");
  }

  const effectiveRoomTypeRequests = await roomTypeRequestsForSelection(ctx, tenantId, args);
  const roomTypes = await roomTypeRulesForRequests(ctx, tenantId, effectiveRoomTypeRequests);
  const buffers = roomTypeBufferMinutes(effectiveRoomTypeRequests, roomTypes);

  return bookingBlocksFromSessionWindow(
    sessionBlock.start,
    sessionBlock.end,
    buffers
  );
}

async function validateRoomTypeRequests(
  ctx: QueryCtx | MutationCtx,
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
    const conflictMetadata = args.tenantSlug
      ? await computeAvailability(ctx, request.tenantId, {
          blocks: request.blocks,
          roomTypeRequests: request.roomTypeRequests,
          requestedRoomIds: request.assignedRoomIds.length
            ? request.assignedRoomIds
            : request.requestedRoomIds,
          roomSelectionMode:
            request.assignedRoomIds.length || request.requestedRoomIds?.length
              ? "SpecificRooms"
              : (request.roomSelectionMode ?? "RoomTypeQuantity"),
          excludeRequestId: request._id,
        })
      : request.conflictMetadata;
    return {
      ...withRooms,
      conflictMetadata,
      comments: args.tenantSlug ? comments : comments.filter((comment) => !comment.internal),
    };
  },
});

export const getPublicRequestByReference = query({
  args: {
    tenantSlug: v.string(),
    requestId: v.id("bookingRequests"),
    requesterEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const tenant = await tenantBySlug(ctx, args.tenantSlug);
    if (!tenant) return null;

    const request = await ctx.db.get(args.requestId);
    if (
      !request ||
      request.tenantId !== tenant._id ||
      normalizeEmail(request.requesterEmail) !== normalizeEmail(args.requesterEmail)
    ) {
      return null;
    }

    const withRooms = await withAssignedRooms(ctx, request);
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_request", (q) => q.eq("requestId", args.requestId))
      .collect();

    return {
      ...withRooms,
      comments: comments.filter((comment) => !comment.internal),
    };
  },
});

export const listMyRequests = query({
  args: { tenantSlug: v.string(), auth: authContextValidator },
  handler: async (ctx, args) => {
    const { tenant, user, identity } = await requireTenantAccess(ctx, args.tenantSlug, args.auth);
    const email = normalizeEmail(identity.email ?? user.email);
    const [byUser, byEmail] = await Promise.all([
      ctx.db
        .query("bookingRequests")
        .withIndex("by_tenant_requester_user", (q) =>
          q.eq("tenantId", tenant._id).eq("requesterUserId", user._id)
        )
        .collect(),
      ctx.db
        .query("bookingRequests")
        .withIndex("by_tenant_requester_email", (q) =>
          q.eq("tenantId", tenant._id).eq("requesterEmail", email)
        )
        .collect(),
    ]);
    const requestsById = new Map([...byUser, ...byEmail].map((request) => [request._id, request]));
    const requests = Array.from(requestsById.values()).sort((a, b) => b.createdAt - a.createdAt);

    return await Promise.all(requests.map((request) => withAssignedRooms(ctx, request)));
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

export const checkRequestAvailability = query({
  args: {
    tenantSlug: v.string(),
    auth: v.optional(authContextValidator),
    overrideAcknowledged: v.optional(v.boolean()),
    roomSelectionMode: v.optional(v.union(v.literal("SpecificRooms"), v.literal("RoomTypeQuantity"))),
    blocks: v.array(v.object({ start: v.string(), end: v.string() })),
    roomTypeRequests: v.array(v.object({ roomTypeId: v.id("roomTypes"), quantity: v.number() })),
    requestedRoomIds: v.optional(v.array(v.id("rooms"))),
  },
  handler: async (ctx, args) => {
    const tenant = await tenantBySlug(ctx, args.tenantSlug);
    if (!tenant) {
      return {
        available: false,
        canSubmit: false,
        highestSeverity: "likely_unavailable" as const,
        summary: "Tenant not found.",
        conflicts: [
          {
            type: "invalid_time" as const,
            severity: "likely_unavailable" as const,
            message: "Tenant not found.",
          },
        ],
      };
    }

    const blocks = await deriveBufferedBlocks(ctx, tenant._id, {
      roomSelectionMode: args.roomSelectionMode ?? "RoomTypeQuantity",
      requestedRoomIds: args.requestedRoomIds,
      roomTypeRequests: args.roomTypeRequests,
      blocks: args.blocks.map((block) => ({
        label: "Session" as const,
        start: block.start,
        end: block.end,
      })),
    });

    const availability = await computeAvailability(ctx, tenant._id, {
      blocks,
      roomTypeRequests: args.roomTypeRequests,
      requestedRoomIds: args.requestedRoomIds,
      roomSelectionMode: args.roomSelectionMode ?? "RoomTypeQuantity",
    });
    const session = sessionBookingRange(blocks);
    const overrideRole = await verifiedBookingNoticeOverrideRole(
      ctx,
      args.tenantSlug,
      args.auth
    );
    const notice = evaluateBookingNoticeWindow({
      sessionStart: session?.start ?? "",
      rules: tenantBookingNoticeRules(tenant),
      timezone: tenant.timezone,
      canOverride: overrideRole !== undefined,
      overrideAcknowledged: args.overrideAcknowledged,
    });

    return availabilityWithNoticeEvaluation(availability, notice);
  },
});

export const createRequest = mutation({
  args: {
    tenantSlug: v.string(),
    auth: v.optional(authContextValidator),
    overrideAcknowledged: v.optional(v.boolean()),
    overrideReason: v.optional(v.string()),
    roomSelectionMode: v.union(v.literal("SpecificRooms"), v.literal("RoomTypeQuantity")),
    requestedRoomIds: v.optional(v.array(v.id("rooms"))),
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
    const tenant = await tenantBySlug(ctx, args.tenantSlug);
    if (!tenant) {
      throw new Error("Tenant not found.");
    }

    const requesterError = validateRequesterDetails(args);
    if (requesterError) {
      throw new Error(requesterError);
    }

    await validateRequesterRoomSelection(ctx, tenant._id, {
      roomSelectionMode: args.roomSelectionMode,
      blocks: args.blocks,
      requestedRoomIds: args.requestedRoomIds,
      roomTypeRequests: args.roomTypeRequests,
    });

    const blocks = await deriveBufferedBlocks(ctx, tenant._id, {
      roomSelectionMode: args.roomSelectionMode,
      requestedRoomIds: args.requestedRoomIds,
      roomTypeRequests: args.roomTypeRequests,
      blocks: args.blocks,
    });

    const blockError = validateBookingBlocks(blocks);
    if (blockError) {
      throw new Error(blockError);
    }

    const openingHoursError = validateSessionWithinOpeningHours(
      blocks.find((block) => block.label === "Session") ?? blocks[1],
      tenant.hoursOfOperation,
      tenant.timezone
    );

    if (openingHoursError) {
      throw new Error(openingHoursError);
    }

    const staffHoursError = validateBookingWithinStaffHours(
      {
        start: blocks[0].start,
        end: blocks[blocks.length - 1].end,
      },
      tenant.hoursOfOperation,
      tenant.timezone
    );

    if (staffHoursError) {
      throw new Error(staffHoursError);
    }

    const overrideRole = await verifiedBookingNoticeOverrideRole(
      ctx,
      args.tenantSlug,
      args.auth
    );
    const canOverrideNotice = overrideRole !== undefined;
    const noticeEvaluation = evaluateBookingNoticeWindow({
      sessionStart: sessionBookingRange(blocks)?.start ?? "",
      rules: tenantBookingNoticeRules(tenant),
      timezone: tenant.timezone,
      canOverride: canOverrideNotice,
      overrideAcknowledged: args.overrideAcknowledged,
    });

    if (!noticeEvaluation.canSubmit) {
      throw new Error(
        noticeEvaluation.canOverride
          ? `${noticeEvaluation.violations[0]?.message ?? "Booking notice limits were exceeded."} Acknowledgement is required to override.`
          : noticeEvaluation.violations[0]?.message ?? "Booking notice limits were exceeded."
      );
    }

    await validateCustomInputs(ctx, tenant._id, args.customInputs);

    const availability = await computeAvailability(ctx, tenant._id, {
      roomSelectionMode: args.roomSelectionMode,
      blocks,
      roomTypeRequests: args.roomTypeRequests,
      requestedRoomIds: args.requestedRoomIds,
    });
    const conflictMetadata = availabilityWithNoticeEvaluation(
      availability,
      noticeEvaluation
    );

    if (!conflictMetadata.canSubmit) {
      throw new Error(conflictMetadata.conflicts[0]?.message ?? conflictMetadata.summary);
    }

    const now = Date.now();
    const requesterUser = await requesterUserByEmail(ctx, tenant._id, args.requesterEmail);
    const normalizedRequesterEmail = normalizeEmail(args.requesterEmail);
    const normalizedCcEmails = args.ccEmails.map(normalizeEmail);
    const requestId = await ctx.db.insert("bookingRequests", {
      requesterUserId: requesterUser?._id,
      requesterName: args.requesterName.trim(),
      requesterEmail: normalizedRequesterEmail,
      requesterPhone: args.requesterPhone,
      sessionName: args.sessionName.trim(),
      attendeeCount: args.attendeeCount,
      details: args.details.trim(),
      ccEmails: normalizedCcEmails,
      timezone: tenant.timezone,
      blocks,
      roomSelectionMode: args.roomSelectionMode,
      requestedRoomIds: args.roomSelectionMode === "SpecificRooms" ? args.requestedRoomIds : undefined,
      roomTypeRequests: args.roomTypeRequests,
      customInputs: args.customInputs,
      attachmentStorageIds: args.attachmentStorageIds,
      tenantId: tenant._id,
      assignedRoomIds: [],
      conflictMetadata,
      bookingNoticeMetadata: noticeEvaluation.violations.length
        ? {
            rules: tenantBookingNoticeRules(tenant),
            canOverride: canOverrideNotice,
            overrideAcknowledged: args.overrideAcknowledged === true,
            overrideReason: args.overrideReason?.trim() || undefined,
            overriddenByRole:
              canOverrideNotice && args.overrideAcknowledged === true
                ? overrideRole
                : undefined,
            requiresAdditionalApproval:
              noticeEvaluation.requiresAdditionalApproval,
            violations: noticeEvaluation.violations,
            evaluatedAt: now,
          }
        : undefined,
      status: "Pending",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("notifications", {
      tenantId: tenant._id,
      requestId,
      message: [
        `New pending request: ${args.sessionName.trim()}`,
        `Requester: ${args.requesterName.trim()} <${normalizedRequesterEmail}>`,
        `When: ${formatRequestWindow(blocks, tenant.timezone)}`,
        `Reference: ${requestId}`,
        conflictMetadata.conflicts.length
          ? `Availability warnings: ${conflictMetadata.conflicts.length}`
          : "Availability warnings: none",
        noticeEvaluation.violations.length
          ? `Booking notice: ${noticeEvaluation.violations.map((violation) => violation.message).join(" ")}`
          : "Booking notice: clear",
      ].join(" | "),
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
    const conflictMetadata = await computeAvailability(ctx, tenant._id, {
      roomSelectionMode: assignedRoomIds.length
        ? "SpecificRooms"
        : (request.roomSelectionMode ?? "RoomTypeQuantity"),
      blocks: request.blocks,
      roomTypeRequests: request.roomTypeRequests,
      requestedRoomIds: assignedRoomIds,
      excludeRequestId: request._id,
    });

    await ctx.db.patch(args.requestId, {
      status: args.status,
      assignedRoomIds,
      conflictMetadata,
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
