import { v } from "convex/values";
import { mutation } from "./_generated/server";

const DEFAULT_MAX_BYTES = 100 * 1024 * 1024;

export const generateUploadUrl = mutation({
  args: { tenantId: v.id("tenants"), sizeBytes: v.number() },
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);
    const maxBytes = tenant?.uploadMaxBytes ?? DEFAULT_MAX_BYTES;
    if (args.sizeBytes > maxBytes) throw new Error("File exceeds the tenant upload size limit.");
    return await ctx.storage.generateUploadUrl();
  },
});
