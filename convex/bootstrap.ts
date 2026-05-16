import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { authContextValidator, membershipsForAuth, requireAdmin } from "./authz";

const SEEDED_TENANT_NAME = "University of Nothing";
const SEEDED_TENANT_SLUG = "university-of-nothing";
const DEFAULT_TIMEZONE = "Europe/London";

const tenantSeedValidator = v.object({
  name: v.string(),
  slug: v.string(),
  timezone: v.optional(v.string()),
  contactEmail: v.optional(v.string()),
  notificationEmails: v.optional(v.array(v.string())),
  hoursOfOperation: v.optional(v.string()),
  uploadMaxBytes: v.optional(v.number()),
  minimumAdvanceBookingDays: v.optional(v.number()),
  maximumAdvanceBookingDays: v.optional(v.number()),
  bookingNoticeViolationMode: v.optional(
    v.union(v.literal("Block"), v.literal("Warn"))
  ),
  workosOrganizationId: v.optional(v.string()),
});

const bootstrapArgsValidator = {
  tenant: v.optional(tenantSeedValidator),
  bootstrapToken: v.optional(v.string()),
  developerEmail: v.optional(v.string()),
  developerName: v.optional(v.string()),
  developerWorkOSUserId: v.optional(v.string()),
  adminEmail: v.optional(v.string()),
  adminName: v.optional(v.string()),
  adminWorkOSUserId: v.optional(v.string()),
};

type TenantSeed = {
  name: string;
  slug: string;
  timezone?: string;
  contactEmail?: string;
  notificationEmails?: string[];
  hoursOfOperation?: string;
  uploadMaxBytes?: number;
  minimumAdvanceBookingDays?: number;
  maximumAdvanceBookingDays?: number;
  bookingNoticeViolationMode?: "Block" | "Warn";
  workosOrganizationId?: string;
};

type BootstrapSeedArgs = {
  tenant?: TenantSeed;
  bootstrapToken?: string;
  developerEmail?: string;
  developerName?: string;
  developerWorkOSUserId?: string;
  adminEmail?: string;
  adminName?: string;
  adminWorkOSUserId?: string;
};

type SeedSummary = {
  tenantId: Id<"tenants">;
  tenantSlug: string;
  developerUserId: Id<"users">;
  adminUserId: Id<"users">;
  campusIds: Id<"campuses">[];
  roomTypeIds: Id<"roomTypes">[];
  roomIds: Id<"rooms">[];
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeSlug(slug: string) {
  return slug.trim().toLowerCase();
}

function seededTenant(input?: TenantSeed): TenantSeed {
  return {
    name: input?.name?.trim() || SEEDED_TENANT_NAME,
    slug: normalizeSlug(input?.slug || SEEDED_TENANT_SLUG),
    timezone: input?.timezone?.trim() || DEFAULT_TIMEZONE,
    contactEmail:
      input?.contactEmail?.trim() || "simhub-admin@example.local",
    notificationEmails: input?.notificationEmails ?? [
      "simhub-admin@example.local",
    ],
    hoursOfOperation: input?.hoursOfOperation?.trim() || "Mon-Fri 08:00-18:00",
    uploadMaxBytes: input?.uploadMaxBytes ?? 104_857_600,
    minimumAdvanceBookingDays: input?.minimumAdvanceBookingDays,
    maximumAdvanceBookingDays: input?.maximumAdvanceBookingDays,
    bookingNoticeViolationMode: input?.bookingNoticeViolationMode ?? "Block",
    workosOrganizationId: input?.workosOrganizationId?.trim() || undefined,
  };
}

async function upsertTenant(ctx: MutationCtx, seed: TenantSeed) {
  const existing = await ctx.db
    .query("tenants")
    .withIndex("by_slug", (q) => q.eq("slug", seed.slug))
    .unique();

  const payload = {
    name: seed.name,
    slug: seed.slug,
    timezone: seed.timezone ?? DEFAULT_TIMEZONE,
    contactEmail: seed.contactEmail ?? "simhub-admin@example.local",
    notificationEmails: seed.notificationEmails ?? [
      "simhub-admin@example.local",
    ],
    hoursOfOperation: seed.hoursOfOperation ?? "Mon-Fri 08:00-18:00",
    uploadMaxBytes: seed.uploadMaxBytes ?? 104_857_600,
    minimumAdvanceBookingDays: seed.minimumAdvanceBookingDays,
    maximumAdvanceBookingDays: seed.maximumAdvanceBookingDays,
    bookingNoticeViolationMode: seed.bookingNoticeViolationMode ?? "Block",
    workosOrganizationId: seed.workosOrganizationId,
  };

  if (existing) {
    await ctx.db.patch(existing._id, payload);
    return existing._id;
  }

  return await ctx.db.insert("tenants", payload);
}

async function upsertUser(
  ctx: MutationCtx,
  tenantId: Id<"tenants">,
  user: {
    email: string;
    name: string;
    role: "Developer" | "Admin";
    workosUserId?: string;
  }
) {
  const email = normalizeEmail(user.email);
  const existing = await ctx.db
    .query("users")
    .withIndex("by_tenant_email", (q) =>
      q.eq("tenantId", tenantId).eq("email", email)
    )
    .unique();

  const payload = {
    tenantId,
    workosUserId: user.workosUserId?.trim() || `email:${email}`,
    email,
    name: user.name.trim() || email,
    role: user.role,
  };

  if (existing) {
    await ctx.db.patch(existing._id, payload);
    return existing._id;
  }

  return await ctx.db.insert("users", payload);
}

async function upsertCampus(
  ctx: MutationCtx,
  tenantId: Id<"tenants">,
  campus: {
    name: string;
    sortOrder: number;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
    details?: string;
  }
) {
  const campuses = await ctx.db
    .query("campuses")
    .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
    .collect();
  const existing = campuses.find((item) => item.name === campus.name);
  const payload = {
    tenantId,
    name: campus.name,
    addressLine1: campus.addressLine1,
    addressLine2: campus.addressLine2,
    city: campus.city,
    region: campus.region,
    postalCode: campus.postalCode,
    country: campus.country,
    details: campus.details,
    active: true,
    sortOrder: campus.sortOrder,
  };

  if (existing) {
    await ctx.db.patch(existing._id, payload);
    return existing._id;
  }

  return await ctx.db.insert("campuses", payload);
}

async function upsertRoomType(
  ctx: MutationCtx,
  tenantId: Id<"tenants">,
  roomType: {
    name: string;
    description: string;
    defaultCapacity: number;
    sortOrder: number;
  }
) {
  const roomTypes = await ctx.db
    .query("roomTypes")
    .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
    .collect();
  const existing = roomTypes.find((item) => item.name === roomType.name);
  const now = Date.now();
  const payload = {
    tenantId,
    name: roomType.name,
    description: roomType.description,
    defaultCapacity: roomType.defaultCapacity,
    maxBookingDurationMinutes: undefined,
    specialRoom: roomType.name !== "Classroom",
    maxDurationHours: undefined,
    isSpecial: undefined,
    active: true,
    sortOrder: roomType.sortOrder,
    updatedAt: now,
  };

  if (existing) {
    await ctx.db.patch(existing._id, payload);
    return existing._id;
  }

  return await ctx.db.insert("roomTypes", {
    ...payload,
    createdAt: now,
  });
}

async function upsertRoom(
  ctx: MutationCtx,
  tenantId: Id<"tenants">,
  room: {
    campusId: Id<"campuses">;
    roomTypeId: Id<"roomTypes">;
    name: string;
    roomCode: string;
    capacity: number;
    description: string;
  }
) {
  const code = room.roomCode.trim().toUpperCase();
  const existing = await ctx.db
    .query("rooms")
    .withIndex("by_tenant_code", (q) =>
      q.eq("tenantId", tenantId).eq("code", code)
    )
    .unique();
  const now = Date.now();
  const payload = {
    tenantId,
    campusId: room.campusId,
    roomTypeId: room.roomTypeId,
    code,
    name: room.name,
    description: room.description,
    capacity: room.capacity,
    active: true,
    updatedAt: now,
  };

  if (existing) {
    await ctx.db.patch(existing._id, payload);
    return existing._id;
  }

  return await ctx.db.insert("rooms", {
    ...payload,
    createdAt: now,
  });
}

async function seedUniversityOfNothing(
  ctx: MutationCtx,
  args: BootstrapSeedArgs
): Promise<SeedSummary> {
  const tenant = seededTenant(args.tenant);
  const tenantId = await upsertTenant(ctx, tenant);
  const developerEmail =
    args.developerEmail?.trim() || "developer@example.local";
  const adminEmail = args.adminEmail?.trim() || "admin@example.local";

  const [developerUserId, adminUserId] = await Promise.all([
    upsertUser(ctx, tenantId, {
      email: developerEmail,
      name: args.developerName || "SimHub Developer",
      role: "Developer",
      workosUserId: args.developerWorkOSUserId,
    }),
    upsertUser(ctx, tenantId, {
      email: adminEmail,
      name: args.adminName || "University Admin",
      role: "Admin",
      workosUserId: args.adminWorkOSUserId,
    }),
  ]);

  const campusPairs = await Promise.all([
    upsertCampus(ctx, tenantId, {
      name: "Brentford",
      addressLine1: "Paragon House",
      addressLine2: "Boston Manor Road",
      city: "Brentford",
      region: "Greater London",
      postalCode: "TW8 9GA",
      country: "United Kingdom",
      details: "Main reception entrance for simulation centre visitors.",
      sortOrder: 10,
    }),
    upsertCampus(ctx, tenantId, {
      name: "Reading",
      addressLine1: "Reading Simulation Centre",
      city: "Reading",
      region: "Berkshire",
      country: "United Kingdom",
      details: "Use campus reception for visitor sign-in.",
      sortOrder: 20,
    }),
  ]);
  const [brentfordCampusId, readingCampusId] = campusPairs;

  const roomTypePairs = await Promise.all([
    upsertRoomType(ctx, tenantId, {
      name: "Ward",
      description: "Clinical ward spaces for scenario-based simulation.",
      defaultCapacity: 12,
      sortOrder: 10,
    }),
    upsertRoomType(ctx, tenantId, {
      name: "Classroom",
      description: "Teaching rooms for briefings, debriefings, and lectures.",
      defaultCapacity: 30,
      sortOrder: 20,
    }),
    upsertRoomType(ctx, tenantId, {
      name: "Skills Lab",
      description: "Practical skills labs with flexible station layouts.",
      defaultCapacity: 18,
      sortOrder: 30,
    }),
  ]);
  const [wardRoomTypeId, classroomRoomTypeId, skillsLabRoomTypeId] =
    roomTypePairs;

  const roomIds = await Promise.all([
    upsertRoom(ctx, tenantId, {
      campusId: brentfordCampusId,
      roomTypeId: wardRoomTypeId,
      name: "Brentford Ward 1",
      roomCode: "B-WARD-1",
      capacity: 12,
      description: "A ward bay configured for acute care simulations.",
    }),
    upsertRoom(ctx, tenantId, {
      campusId: brentfordCampusId,
      roomTypeId: classroomRoomTypeId,
      name: "Brentford Classroom A",
      roomCode: "B-CLASS-A",
      capacity: 32,
      description: "Flexible classroom for teaching and debrief sessions.",
    }),
    upsertRoom(ctx, tenantId, {
      campusId: readingCampusId,
      roomTypeId: skillsLabRoomTypeId,
      name: "Reading Skills Lab",
      roomCode: "R-SKILLS-1",
      capacity: 18,
      description: "Open skills lab with movable practice stations.",
    }),
    upsertRoom(ctx, tenantId, {
      campusId: readingCampusId,
      roomTypeId: wardRoomTypeId,
      name: "Reading Ward 2",
      roomCode: "R-WARD-2",
      capacity: 10,
      description: "Compact ward room for small-group clinical scenarios.",
    }),
  ]);

  return {
    tenantId,
    tenantSlug: tenant.slug,
    developerUserId,
    adminUserId,
    campusIds: campusPairs,
    roomTypeIds: roomTypePairs,
    roomIds,
  };
}

function assertDevResetAllowed(args: {
  confirm: string;
  environment: string;
  resetToken?: string;
}) {
  if (args.confirm !== "RESET_LOCAL_DEV") {
    throw new Error('Dev reset requires confirm: "RESET_LOCAL_DEV"');
  }

  const environment = args.environment.trim().toLowerCase();
  if (!["development", "dev", "local", "test"].includes(environment)) {
    throw new Error("Dev reset is only allowed in development/local/test.");
  }

  if (
    process.env.SIMHUB_ENV?.toLowerCase() === "production" ||
    process.env.VERCEL_ENV?.toLowerCase() === "production" ||
    process.env.NODE_ENV?.toLowerCase() === "production"
  ) {
    throw new Error("Dev reset is blocked in production environments.");
  }

  if (process.env.SIMHUB_ALLOW_DEV_RESET !== "true") {
    throw new Error(
      "Dev reset requires SIMHUB_ALLOW_DEV_RESET=true in the Convex environment."
    );
  }

  const expectedToken = process.env.SIMHUB_DEV_RESET_TOKEN;
  if (expectedToken && args.resetToken !== expectedToken) {
    throw new Error("Invalid dev reset token.");
  }
}

function assertBootstrapAllowed(args: { bootstrapToken?: string }) {
  if (
    process.env.SIMHUB_ENV?.toLowerCase() === "production" ||
    process.env.VERCEL_ENV?.toLowerCase() === "production" ||
    process.env.NODE_ENV?.toLowerCase() === "production"
  ) {
    throw new Error("Bootstrap is blocked in production environments.");
  }

  if (process.env.SIMHUB_ALLOW_BOOTSTRAP !== "true") {
    throw new Error(
      "Bootstrap requires SIMHUB_ALLOW_BOOTSTRAP=true in the Convex environment."
    );
  }

  const expectedToken = process.env.SIMHUB_BOOTSTRAP_TOKEN;
  if (expectedToken && args.bootstrapToken !== expectedToken) {
    throw new Error("Invalid bootstrap token.");
  }
}

async function deleteBookingChildren(ctx: MutationCtx, tenantId: Id<"tenants">) {
  const requests = await ctx.db
    .query("bookingRequests")
    .withIndex("by_tenant_created", (q) => q.eq("tenantId", tenantId))
    .collect();
  const requestIds = new Set(requests.map((request) => request._id));
  const [comments, notifications] = await Promise.all([
    ctx.db.query("comments").collect(),
    ctx.db.query("notifications").collect(),
  ]);

  await Promise.all([
    ...comments
      .filter((comment) => requestIds.has(comment.requestId))
      .map((comment) => ctx.db.delete(comment._id)),
    ...notifications
      .filter((notification) => notification.tenantId === tenantId)
      .map((notification) => ctx.db.delete(notification._id)),
  ]);

  await Promise.all(requests.map((request) => ctx.db.delete(request._id)));

  return {
    comments: comments.filter((comment) => requestIds.has(comment.requestId))
      .length,
    notifications: notifications.filter(
      (notification) => notification.tenantId === tenantId
    ).length,
    bookingRequests: requests.length,
  };
}

async function deleteBlockedTimes(ctx: MutationCtx, tenantId: Id<"tenants">) {
  const docs = await ctx.db
    .query("blockedTimes")
    .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
    .collect();
  await Promise.all(docs.map((doc) => ctx.db.delete(doc._id)));
  return docs.length;
}

async function deleteFormConfigs(ctx: MutationCtx, tenantId: Id<"tenants">) {
  const docs = await ctx.db
    .query("formConfigs")
    .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
    .collect();
  await Promise.all(docs.map((doc) => ctx.db.delete(doc._id)));
  return docs.length;
}

async function deleteRooms(ctx: MutationCtx, tenantId: Id<"tenants">) {
  const docs = await ctx.db
    .query("rooms")
    .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
    .collect();
  await Promise.all(docs.map((doc) => ctx.db.delete(doc._id)));
  return docs.length;
}

async function deleteRoomTypes(ctx: MutationCtx, tenantId: Id<"tenants">) {
  const docs = await ctx.db
    .query("roomTypes")
    .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
    .collect();
  await Promise.all(docs.map((doc) => ctx.db.delete(doc._id)));
  return docs.length;
}

async function deleteCampuses(ctx: MutationCtx, tenantId: Id<"tenants">) {
  const docs = await ctx.db
    .query("campuses")
    .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
    .collect();
  await Promise.all(docs.map((doc) => ctx.db.delete(doc._id)));
  return docs.length;
}

async function deleteUsers(ctx: MutationCtx, tenantId: Id<"tenants">) {
  const roleBuckets = await Promise.all(
    (["Developer", "Admin", "Staff", "Requester"] as const).map((role) =>
      ctx.db
        .query("users")
        .withIndex("by_tenant_role", (q) =>
          q.eq("tenantId", tenantId).eq("role", role)
        )
        .collect()
    )
  );
  const docs = roleBuckets.flat();
  await Promise.all(docs.map((doc) => ctx.db.delete(doc._id)));
  return docs.length;
}

async function resetTenant(ctx: MutationCtx, tenant: Doc<"tenants">) {
  const bookingCounts = await deleteBookingChildren(ctx, tenant._id);
  const [blockedTimes, formConfigs, rooms, roomTypes, campuses, users] =
    await Promise.all([
      deleteBlockedTimes(ctx, tenant._id),
      deleteFormConfigs(ctx, tenant._id),
      deleteRooms(ctx, tenant._id),
      deleteRoomTypes(ctx, tenant._id),
      deleteCampuses(ctx, tenant._id),
      deleteUsers(ctx, tenant._id),
    ]);

  await ctx.db.delete(tenant._id);

  return {
    ...bookingCounts,
    blockedTimes,
    formConfigs,
    rooms,
    roomTypes,
    campuses,
    users,
    tenants: 1,
  };
}

export const bootstrap = mutation({
  args: bootstrapArgsValidator,
  handler: async (ctx, args) => {
    assertBootstrapAllowed(args);
    return await seedUniversityOfNothing(ctx, args);
  },
});

export const seed = mutation({
  args: {
    auth: authContextValidator,
    ...bootstrapArgsValidator,
  },
  handler: async (ctx, args) => {
    const memberships = await membershipsForAuth(ctx, args.auth);
    const isDeveloper = memberships.some(({ user }) => user.role === "Developer");

    if (!isDeveloper) {
      await requireAdmin(ctx, args.tenant?.slug || SEEDED_TENANT_SLUG, args.auth);
    }

    return await seedUniversityOfNothing(ctx, args);
  },
});

export const resetDev = mutation({
  args: {
    confirm: v.string(),
    environment: v.string(),
    resetToken: v.optional(v.string()),
    tenantSlug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertDevResetAllowed(args);
    const tenantSlug = normalizeSlug(args.tenantSlug || SEEDED_TENANT_SLUG);
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", tenantSlug))
      .unique();

    if (!tenant) {
      return { tenantSlug, deleted: null };
    }

    return { tenantSlug, deleted: await resetTenant(ctx, tenant) };
  },
});
