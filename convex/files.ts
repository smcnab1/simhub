import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { authContextValidator, requireAdmin } from "./authz";

const DEFAULT_MAX_BYTES = 100 * 1024 * 1024;
const ROOM_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export const generateUploadUrl = mutation({
  args: { tenantId: v.id("tenants"), sizeBytes: v.number() },
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);
    const maxBytes = tenant?.uploadMaxBytes ?? DEFAULT_MAX_BYTES;
    if (args.sizeBytes > maxBytes) throw new Error("File exceeds the tenant upload size limit.");
    return await ctx.storage.generateUploadUrl();
  },
});

export const generateRoomImageUploadUrl = mutation({
  args: {
    tenantSlug: v.string(),
    auth: authContextValidator,
    sizeBytes: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.tenantSlug, args.auth);

    if (args.sizeBytes <= 0) {
      throw new Error("Room image is empty.");
    }

    if (args.sizeBytes > ROOM_IMAGE_MAX_BYTES) {
      throw new Error("Room image must be 10 MB or smaller.");
    }

    return await ctx.storage.generateUploadUrl();
  },
});
