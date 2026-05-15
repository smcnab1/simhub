import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tenants: defineTable({
    name: v.string(),
    slug: v.string(),
    timezone: v.string(),
    contactEmail: v.string(),
    notificationEmails: v.array(v.string()),
    hoursOfOperation: v.string(),
    logoStorageId: v.optional(v.id("_storage")),
    uploadMaxBytes: v.number(),
    workosOrganizationId: v.optional(v.string()),
  })
    .index("by_slug", ["slug"])
    .index("by_workos_org", ["workosOrganizationId"]),

  users: defineTable({
    tenantId: v.id("tenants"),
    workosUserId: v.string(),
    email: v.string(),
    name: v.string(),
    role: v.union(
      v.literal("Developer"),
      v.literal("Admin"),
      v.literal("Staff"),
      v.literal("Requester")
    ),
  })
    .index("by_tenant_role", ["tenantId", "role"])
    .index("by_workos_user", ["workosUserId"])
    .index("by_tenant_email", ["tenantId", "email"]),

  campuses: defineTable({
    tenantId: v.id("tenants"),
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
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    archivedAt: v.optional(v.number()),
  }).index("by_tenant", ["tenantId"]),

  roomTypes: defineTable({
    tenantId: v.id("tenants"),
    campusId: v.optional(v.id("campuses")),

    // e.g. Classroom, Ward, Immersive Room, Control Room
    name: v.string(),
    description: v.optional(v.string()),

    // Default value used when creating rooms of this type.
    // Actual room capacity should live on rooms.capacity.
    defaultCapacity: v.number(),

    // Optional rule for bookings of this room type.
    maxBookingDurationMinutes: v.optional(v.number()),
    // Legacy field kept optional while existing data is backfilled.
    maxDurationHours: v.optional(v.number()),

    // Use for specialist spaces that need extra admin attention.
    specialRoom: v.optional(v.boolean()),
    // Legacy field kept optional while existing data is backfilled.
    isSpecial: v.optional(v.boolean()),

    active: v.boolean(),
    sortOrder: v.optional(v.number()),

    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_campus", ["tenantId", "campusId"])
    .index("by_tenant_active", ["tenantId", "active"]),

  rooms: defineTable({
    tenantId: v.id("tenants"),
    campusId: v.optional(v.id("campuses")),
    roomTypeId: v.id("roomTypes"),

    // e.g. PH900, PH901, PH902
    code: v.string(),

    // e.g. Classroom PH900, Ward 1, Immersive Suite
    name: v.string(),

    description: v.optional(v.string()),
    capacity: v.number(),

    // Convex file storage image for the room.
    imageStorageId: v.optional(v.id("_storage")),

    active: v.boolean(),

    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_tenant_type", ["tenantId", "roomTypeId"])
    .index("by_tenant_campus", ["tenantId", "campusId"])
    .index("by_tenant_code", ["tenantId", "code"])
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_active", ["tenantId", "active"]),

  bookingRequests: defineTable({
    tenantId: v.id("tenants"),
    requesterUserId: v.optional(v.id("users")),

    requesterName: v.string(),
    requesterEmail: v.string(),
    requesterPhone: v.optional(v.string()),

    sessionName: v.string(),
    attendeeCount: v.number(),
    details: v.string(),
    ccEmails: v.array(v.string()),

    status: v.union(
      v.literal("Pending"),
      v.literal("Approved"),
      v.literal("Completed"),
      v.literal("Declined"),
      v.literal("Cancelled")
    ),

    timezone: v.string(),

    blocks: v.array(
      v.object({
        label: v.union(
          v.literal("Setup"),
          v.literal("Session"),
          v.literal("Cleanup")
        ),
        start: v.string(),
        end: v.string(),
      })
    ),

    /**
     * Room selection intent:
     *
     * SpecificRooms:
     * - user/admin selected exact rooms.
     * - requestedRoomIds should be populated.
     *
     * RoomTypeQuantity:
     * - user requested a type and quantity, e.g. 2 classrooms.
     * - roomTypeRequests should be populated.
     */
    roomSelectionMode: v.optional(
      v.union(
        v.literal("SpecificRooms"),
        v.literal("RoomTypeQuantity")
      )
    ),

    requestedRoomIds: v.optional(v.array(v.id("rooms"))),

    roomTypeRequests: v.array(
      v.object({
        roomTypeId: v.id("roomTypes"),
        quantity: v.number(),
      })
    ),

    assignedRoomIds: v.array(v.id("rooms")),

    allocationStatus: v.optional(
      v.union(
        v.literal("Unallocated"),
        v.literal("AutoAllocated"),
        v.literal("ManuallyAdjusted"),
        v.literal("Conflict")
      )
    ),

    allocationNotes: v.optional(v.string()),
    allocationUpdatedByUserId: v.optional(v.id("users")),
    allocationUpdatedAt: v.optional(v.number()),

    conflictMetadata: v.optional(
      v.object({
        available: v.boolean(),
        canSubmit: v.boolean(),
        highestSeverity: v.optional(
          v.union(
            v.literal("informational"),
            v.literal("warning"),
            v.literal("likely_unavailable")
          )
        ),
        summary: v.string(),
        conflicts: v.array(
          v.object({
            type: v.union(
              v.literal("invalid_time"),
              v.literal("duration_rule"),
              v.literal("exact_room_overlap"),
              v.literal("pending_overlap"),
              v.literal("room_type_exhausted"),
              v.literal("blocked_period"),
              v.literal("campus_unavailable")
            ),
            severity: v.union(
              v.literal("informational"),
              v.literal("warning"),
              v.literal("likely_unavailable")
            ),
            message: v.string(),
            roomId: v.optional(v.string()),
            roomCode: v.optional(v.string()),
            roomName: v.optional(v.string()),
            roomTypeId: v.optional(v.string()),
            roomTypeName: v.optional(v.string()),
            campusId: v.optional(v.string()),
            campusName: v.optional(v.string()),
            conflictingRequestId: v.optional(v.string()),
            conflictingStatus: v.optional(
              v.union(
                v.literal("Pending"),
                v.literal("Approved"),
                v.literal("Completed")
              )
            ),
            blockedTimeId: v.optional(v.string()),
            blockedReason: v.optional(v.string()),
            overlapStart: v.optional(v.string()),
            overlapEnd: v.optional(v.string()),
          })
        ),
      })
    ),

    customInputs: v.array(
      v.object({
        fieldId: v.string(),
        label: v.string(),
        value: v.any(),
      })
    ),

    attachmentStorageIds: v.array(v.id("_storage")),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenant_status", ["tenantId", "status"])
    .index("by_tenant_created", ["tenantId", "createdAt"])
    .index("by_tenant_requester_user", ["tenantId", "requesterUserId"])
    .index("by_tenant_requester_email", ["tenantId", "requesterEmail"])
    .index("by_tenant_allocation_status", ["tenantId", "allocationStatus"]),

  comments: defineTable({
    tenantId: v.id("tenants"),
    requestId: v.id("bookingRequests"),
    authorUserId: v.optional(v.id("users")),
    bodyMarkdown: v.string(),
    internal: v.boolean(),
    createdAt: v.number(),
  }).index("by_request", ["requestId"]),

  notifications: defineTable({
    tenantId: v.id("tenants"),
    userId: v.optional(v.id("users")),
    requestId: v.optional(v.id("bookingRequests")),
    message: v.string(),
    seen: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_tenant_seen", ["tenantId", "seen"])
    .index("by_user_seen", ["userId", "seen"]),

  formConfigs: defineTable({
    tenantId: v.id("tenants"),
    fileUploadEnabled: v.boolean(),
    fields: v.array(
      v.object({
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
      })
    ),
  }).index("by_tenant", ["tenantId"]),

  blockedTimes: defineTable({
    tenantId: v.id("tenants"),

    // If roomId is provided, block one room.
    // If roomTypeId is provided, block all rooms of that type.
    // If neither is provided, treat as a tenant-wide unavailable period if needed.
    roomId: v.optional(v.id("rooms")),
    roomTypeId: v.optional(v.id("roomTypes")),
    campusId: v.optional(v.id("campuses")),

    start: v.string(),
    end: v.string(),
    reason: v.string(),

    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_room", ["tenantId", "roomId"])
    .index("by_tenant_room_type", ["tenantId", "roomTypeId"])
    .index("by_tenant_campus", ["tenantId", "campusId"]),
});
