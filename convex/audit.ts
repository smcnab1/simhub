import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import {
  authContextValidator,
  requireStaff,
  requireTenantAccess,
  tenantBySlug,
} from "./authz";
import type {
  AuditDiffEntry,
  AuditEntityType,
  AuditEventType,
  AuditSeverityLevel,
  AuditVisibilityLevel,
} from "../src/lib/audit-types";

export type AuditActorSnapshot = {
  userId?: Id<"users">;
  name?: string;
  email?: string;
};

export type AuditEventInput = {
  eventType: AuditEventType;
  entityType: AuditEntityType;
  entityId: string;
  bookingId?: Id<"bookingRequests">;
  tenantId: Id<"tenants">;
  actor?: AuditActorSnapshot;
  visibility?: AuditVisibilityLevel;
  severity?: AuditSeverityLevel;
  message: string;
  metadata?: unknown;
  diff?: AuditDiffEntry[];
};

export function actorFromUser(user?: Doc<"users"> | null): AuditActorSnapshot {
  return {
    userId: user?._id,
    name: user?.name,
    email: user?.email,
  };
}

export function compactDiff<T extends Record<string, unknown>>(
  before: T,
  after: T,
  fields: Array<keyof T>
): AuditDiffEntry[] {
  return fields.flatMap((field) => {
    const beforeValue = before[field];
    const afterValue = after[field];

    if (JSON.stringify(beforeValue) === JSON.stringify(afterValue)) {
      return [];
    }

    return [{ field: String(field), before: beforeValue, after: afterValue }];
  });
}

export async function recordAuditEvent(ctx: MutationCtx, input: AuditEventInput) {
  return await ctx.db.insert("auditEvents", {
    eventType: input.eventType,
    entityType: input.entityType,
    entityId: input.entityId,
    bookingId: input.bookingId,
    tenantId: input.tenantId,
    actorUserId: input.actor?.userId,
    actorName: input.actor?.name,
    actorEmail: input.actor?.email,
    visibility: input.visibility ?? "staff",
    severity: input.severity ?? "info",
    message: input.message,
    metadata: input.metadata,
    diff: input.diff,
    createdAt: Date.now(),
  });
}

function requesterCanSeeEvent(event: Doc<"auditEvents">) {
  return event.visibility === "public" || event.visibility === "requester";
}

export const listForBooking = query({
  args: {
    tenantSlug: v.string(),
    auth: authContextValidator,
    bookingId: v.id("bookingRequests"),
  },
  handler: async (ctx, args) => {
    const { tenant, user, identity } = await requireTenantAccess(
      ctx,
      args.tenantSlug,
      args.auth
    );
    const request = await ctx.db.get(args.bookingId);

    if (!request || request.tenantId !== tenant._id) {
      throw new Error("Request not found");
    }

    const isStaff =
      user.role === "Developer" || user.role === "Admin" || user.role === "Staff";
    const requesterEmail = (identity.email ?? user.email).trim().toLowerCase();
    const ownsRequest =
      request.requesterUserId === user._id ||
      request.requesterEmail.trim().toLowerCase() === requesterEmail ||
      request.ccEmails.some((email) => email.trim().toLowerCase() === requesterEmail);

    if (!isStaff && !ownsRequest) {
      throw new Error("Request not found");
    }

    const events = await ctx.db
      .query("auditEvents")
      .withIndex("by_tenant_booking_created", (q) =>
        q.eq("tenantId", tenant._id).eq("bookingId", args.bookingId)
      )
      .order("desc")
      .take(100);

    return isStaff ? events : events.filter(requesterCanSeeEvent);
  },
});

export const listPublicForBooking = query({
  args: {
    tenantSlug: v.string(),
    bookingId: v.id("bookingRequests"),
    requesterEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const tenant = await tenantBySlug(ctx, args.tenantSlug);
    if (!tenant) return [];

    const request = await ctx.db.get(args.bookingId);
    if (
      !request ||
      request.tenantId !== tenant._id ||
      request.requesterEmail.trim().toLowerCase() !==
        args.requesterEmail.trim().toLowerCase()
    ) {
      return [];
    }

    const events = await ctx.db
      .query("auditEvents")
      .withIndex("by_tenant_booking_created", (q) =>
        q.eq("tenantId", tenant._id).eq("bookingId", args.bookingId)
      )
      .order("desc")
      .take(100);

    return events.filter(requesterCanSeeEvent);
  },
});

export const listTenantEvents = query({
  args: {
    tenantSlug: v.string(),
    auth: authContextValidator,
    bookingId: v.optional(v.id("bookingRequests")),
    userId: v.optional(v.id("users")),
    eventType: v.optional(v.string()),
    actor: v.optional(v.string()),
    search: v.optional(v.string()),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    cursor: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireStaff(ctx, args.tenantSlug, args.auth);
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);
    const upperBound = Math.min(args.cursor ?? Number.MAX_SAFE_INTEGER, args.to ?? Number.MAX_SAFE_INTEGER);
    const lowerBound = args.from ?? 0;

    const filteredEventType = args.eventType;
    const source = args.bookingId
      ? await ctx.db
          .query("auditEvents")
          .withIndex("by_tenant_booking_created", (q) =>
            q.eq("tenantId", tenant._id).eq("bookingId", args.bookingId)
              .gte("createdAt", lowerBound)
              .lte("createdAt", upperBound)
          )
          .order("desc")
          .collect()
      : args.userId
        ? await ctx.db
            .query("auditEvents")
            .withIndex("by_tenant_actor_created", (q) =>
              q.eq("tenantId", tenant._id).eq("actorUserId", args.userId)
                .gte("createdAt", lowerBound)
                .lte("createdAt", upperBound)
            )
            .order("desc")
            .collect()
        : filteredEventType
          ? await ctx.db
              .query("auditEvents")
              .withIndex("by_tenant_event_created", (q) =>
                q.eq("tenantId", tenant._id).eq("eventType", filteredEventType)
                  .gte("createdAt", lowerBound)
                  .lte("createdAt", upperBound)
              )
              .order("desc")
              .collect()
          : await ctx.db
              .query("auditEvents")
              .withIndex("by_tenant_created", (q) =>
                q.eq("tenantId", tenant._id)
                  .gte("createdAt", lowerBound)
                  .lte("createdAt", upperBound)
              )
              .order("desc")
              .collect();

    const actorTerm = args.actor?.trim().toLowerCase();
    const searchTerm = args.search?.trim().toLowerCase();
    const filtered = source.filter((event) => {
      if (actorTerm) {
        const actorText = `${event.actorName ?? ""} ${event.actorEmail ?? ""}`.toLowerCase();
        if (!actorText.includes(actorTerm)) return false;
      }
      if (searchTerm) {
        const searchable = [
          event.eventType,
          event.entityType,
          event.entityId,
          event.bookingId,
          event.message,
          event.actorName,
          event.actorEmail,
          event.severity,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!searchable.includes(searchTerm)) return false;
      }
      return true;
    });
    const page = filtered.slice(0, limit);
    const nextCursor =
      filtered.length > limit ? page[page.length - 1]?.createdAt : undefined;

    return {
      events: page,
      nextCursor,
      hasMore: filtered.length > limit,
    };
  },
});
