"use node";

import { v } from "convex/values";
import { Resend } from "resend";
import { internalAction } from "./_generated/server";

const emailBlockValidator = v.object({
  label: v.union(
    v.literal("Setup"),
    v.literal("Session"),
    v.literal("Cleanup")
  ),
  start: v.string(),
  end: v.string(),
});

const emailBookingValidator = v.object({
  id: v.string(),
  sessionName: v.string(),
  timezone: v.string(),
  blocks: v.array(emailBlockValidator),
  requestedRooms: v.optional(
    v.array(
      v.object({
        name: v.string(),
        code: v.optional(v.string()),
      })
    )
  ),
  roomTypeRequests: v.array(
    v.object({
      roomTypeName: v.string(),
      quantity: v.number(),
    })
  ),
});

type EmailBooking = {
  id: string;
  sessionName: string;
  timezone: string;
  blocks: Array<{
    label: "Setup" | "Session" | "Cleanup";
    start: string;
    end: string;
  }>;
  requestedRooms?: Array<{ name: string; code?: string }>;
  roomTypeRequests: Array<{ roomTypeName: string; quantity: number }>;
};

type EmailPayload = {
  to: string[];
  subject: string;
  text: string;
};

let resendClient: Resend | null = null;
let resendClientKey: string | null = null;

function getResend(apiKey: string) {
  if (!resendClient || resendClientKey !== apiKey) {
    resendClient = new Resend(apiKey);
    resendClientKey = apiKey;
  }

  return resendClient;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function uniqueEmails(emails: string[]) {
  return Array.from(
    new Set(emails.map(normalizeEmail).filter((email) => email.length > 0))
  );
}

function formatDateTime(value: string, timezone: string) {
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

function formatTime(value: string, timezone: string) {
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

function formatSessionWindow(booking: EmailBooking) {
  const session =
    booking.blocks.find((block) => block.label === "Session") ??
    booking.blocks[0];

  if (!session) {
    return "Time to be confirmed";
  }

  return `${formatDateTime(session.start, booking.timezone)} to ${formatTime(session.end, booking.timezone)}`;
}

function formatRequestedResources(booking: EmailBooking) {
  if (booking.requestedRooms?.length) {
    return booking.requestedRooms
      .map((room) => (room.code ? `${room.name} (${room.code})` : room.name))
      .join(", ");
  }

  if (booking.roomTypeRequests.length) {
    return booking.roomTypeRequests
      .map(
        (request) =>
          `${request.quantity} ${request.roomTypeName}${request.quantity === 1 ? "" : "s"}`
      )
      .join(", ");
  }

  return "No requested rooms recorded";
}

async function deliverEmail(payload: EmailPayload) {
  const to = uniqueEmails(payload.to);

  if (to.length === 0) {
    console.info("[email] skipped email with no recipients", {
      subject: payload.subject,
    });
    return { ok: true, mode: "skipped" as const };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const devMode = process.env.EMAIL_DEV_MODE === "true";
  const email = { ...payload, to };

  if (devMode || !apiKey || !from) {
    console.info("[email] dev/no-key email payload", email);
    return { ok: true, mode: "logged" as const };
  }

  const result = await getResend(apiKey).emails.send({
    from,
    to,
    subject: payload.subject,
    text: payload.text,
  });

  if (result.error) {
    console.error("[email] Resend returned an error", {
      error: result.error,
      subject: payload.subject,
      to,
    });
    return { ok: false, mode: "failed" as const };
  }

  return { ok: true, mode: "sent" as const, id: result.data?.id };
}

export const sendNewRequestEmail = internalAction({
  args: {
    tenantName: v.string(),
    to: v.array(v.string()),
    booking: emailBookingValidator,
  },
  handler: async (_ctx, args) => {
    try {
      return await deliverEmail({
        to: args.to,
        subject: `New booking request: ${args.booking.sessionName}`,
        text: [
          `Tenant: ${args.tenantName}`,
          `Reference: ${args.booking.id}`,
          `Session: ${args.booking.sessionName}`,
          `When: ${formatSessionWindow(args.booking)}`,
          `Requested rooms/type: ${formatRequestedResources(args.booking)}`,
          "Status: Pending",
        ].join("\n"),
      });
    } catch (error) {
      console.error("[email] failed to send new request email", {
        error,
        bookingId: args.booking.id,
        tenantName: args.tenantName,
      });
      return { ok: false, mode: "failed" as const };
    }
  },
});

export const sendStatusUpdateEmail = internalAction({
  args: {
    to: v.array(v.string()),
    tenantName: v.string(),
    booking: emailBookingValidator,
    status: v.union(
      v.literal("Pending"),
      v.literal("Approved"),
      v.literal("Confirmed"),
      v.literal("Completed"),
      v.literal("Declined"),
      v.literal("Cancelled")
    ),
    reason: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    try {
      return await deliverEmail({
        to: args.to,
        subject: `Booking request ${args.status}: ${args.booking.sessionName}`,
        text: [
          `Tenant: ${args.tenantName}`,
          `Reference: ${args.booking.id}`,
          `Session: ${args.booking.sessionName}`,
          `When: ${formatSessionWindow(args.booking)}`,
          `Requested rooms/type: ${formatRequestedResources(args.booking)}`,
          `Status: ${args.status}`,
          ...(args.reason ? [`Reason: ${args.reason}`] : []),
        ].join("\n"),
      });
    } catch (error) {
      console.error("[email] failed to send status update email", {
        error,
        bookingId: args.booking.id,
        tenantName: args.tenantName,
        status: args.status,
      });
      return { ok: false, mode: "failed" as const };
    }
  },
});

export const sendCommentAddedEmail = internalAction({
  args: {
    to: v.array(v.string()),
    tenantName: v.string(),
    booking: emailBookingValidator,
  },
  handler: async (_ctx, args) => {
    try {
      return await deliverEmail({
        to: args.to,
        subject: `New booking comment: ${args.booking.sessionName}`,
        text: [
          `Tenant: ${args.tenantName}`,
          `Reference: ${args.booking.id}`,
          `Session: ${args.booking.sessionName}`,
          `When: ${formatSessionWindow(args.booking)}`,
          `Requested rooms/type: ${formatRequestedResources(args.booking)}`,
          "A new public comment was added to this booking request.",
        ].join("\n"),
      });
    } catch (error) {
      console.error("[email] failed to send comment email", {
        error,
        bookingId: args.booking.id,
        tenantName: args.tenantName,
      });
      return { ok: false, mode: "failed" as const };
    }
  },
});

export const sendBookingUpdatedEmail = internalAction({
  args: {
    to: v.array(v.string()),
    tenantName: v.string(),
    booking: emailBookingValidator,
    changeSummary: v.string(),
  },
  handler: async (_ctx, args) => {
    try {
      return await deliverEmail({
        to: args.to,
        subject: `Booking request updated: ${args.booking.sessionName}`,
        text: [
          `Tenant: ${args.tenantName}`,
          `Reference: ${args.booking.id}`,
          `Session: ${args.booking.sessionName}`,
          `When: ${formatSessionWindow(args.booking)}`,
          `Requested rooms/type: ${formatRequestedResources(args.booking)}`,
          args.changeSummary,
        ].join("\n"),
      });
    } catch (error) {
      console.error("[email] failed to send booking update email", {
        error,
        bookingId: args.booking.id,
        tenantName: args.tenantName,
      });
      return { ok: false, mode: "failed" as const };
    }
  },
});
