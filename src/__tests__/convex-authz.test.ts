import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import {
  requireAdmin,
  requireStaff,
  requireTenantAccess,
} from "../../convex/authz";

type Tenant = {
  _id: string;
  slug: string;
  workosOrganizationId?: string;
};

type User = {
  _id: string;
  tenantId: string;
  workosUserId: string;
  email: string;
  role: "Admin" | "Staff" | "Requester";
};

function createCtx({
  identity,
  tenants = [],
  users = [],
}: {
  identity: Record<string, unknown> | null;
  tenants?: Tenant[];
  users?: User[];
}) {
  return {
    auth: {
      getUserIdentity: async () => identity,
    },
    db: {
      query(table: "tenants" | "users") {
        return {
          withIndex(
            index: string,
            buildQuery: (q: {
              eq: (field: string, value: unknown) => typeof q;
            }) => unknown
          ) {
            const filters: Array<{ field: string; value: unknown }> = [];
            const q = {
              eq(field: string, value: unknown) {
                filters.push({ field, value });
                return q;
              },
            };

            buildQuery(q);

            const matches = () => {
              if (table === "tenants") {
                if (index === "by_slug") {
                  return tenants.filter(
                    (tenant) =>
                      tenant.slug ===
                      filters.find((filter) => filter.field === "slug")?.value
                  );
                }

                return tenants.filter(
                  (tenant) =>
                    tenant.workosOrganizationId ===
                    filters.find(
                      (filter) => filter.field === "workosOrganizationId"
                    )?.value
                );
              }

              return users.filter((user) =>
                filters.every(
                  (filter) => user[filter.field as keyof User] === filter.value
                )
              );
            };

            return {
              unique: async () => matches()[0] ?? null,
              collect: async () => matches(),
            };
          },
        };
      },
    },
  };
}

function expectConvexCode(error: unknown, code: string) {
  expect(error).toBeInstanceOf(ConvexError);
  expect((error as ConvexError<{ code: string }>).data.code).toBe(code);
}

const tenant = {
  _id: "tenant_1",
  slug: "demo",
  workosOrganizationId: "org_123",
};

describe("Convex tenant authz helpers", () => {
  it("resolves a user by WorkOS user ID first", async () => {
    const ctx = createCtx({
      identity: { subject: "user_123", email: "other@example.com" },
      tenants: [tenant],
      users: [
        {
          _id: "user_1",
          tenantId: tenant._id,
          workosUserId: "user_123",
          email: "staff@example.com",
          role: "Staff",
        },
      ],
    });

    await expect(
      requireStaff(ctx as never, "demo", {
        workosUserId: "user_123",
        email: "other@example.com",
      })
    ).resolves.toMatchObject({
      tenant,
      user: { _id: "user_1" },
    });
  });

  it("falls back to case-insensitive email matching within the tenant", async () => {
    const ctx = createCtx({
      identity: { subject: "user_missing", email: "STAFF@example.com" },
      tenants: [tenant],
      users: [
        {
          _id: "user_1",
          tenantId: tenant._id,
          workosUserId: "email:staff@example.com",
          email: "staff@example.com",
          role: "Staff",
        },
      ],
    });

    await expect(
      requireStaff(ctx as never, "demo", {
        workosUserId: "user_missing",
        email: "STAFF@example.com",
      })
    ).resolves.toMatchObject({
      user: { _id: "user_1" },
    });
  });

  it("resolves the tenant by WorkOS organization ID when the slug is missing", async () => {
    const ctx = createCtx({
      identity: {
        subject: "user_123",
        email: "admin@example.com",
        org_id: "org_123",
      },
      tenants: [tenant],
      users: [
        {
          _id: "user_1",
          tenantId: tenant._id,
          workosUserId: "user_123",
          email: "admin@example.com",
          role: "Admin",
        },
      ],
    });

    await expect(
      requireAdmin(ctx as never, "missing", {
        workosUserId: "user_123",
        email: "admin@example.com",
        workosOrganizationId: "org_123",
      })
    ).resolves.toMatchObject({
      tenant,
      user: { _id: "user_1" },
    });
  });

  it("rejects unauthenticated requests explicitly", async () => {
    const ctx = createCtx({ identity: null, tenants: [tenant] });

    await expect(
      requireTenantAccess(ctx as never, "demo", {})
    ).rejects.toSatisfy((error: unknown) => {
      expectConvexCode(error, "unauthenticated");
      return true;
    });
  });

  it("rejects users that are not linked to the tenant", async () => {
    const ctx = createCtx({
      identity: { subject: "user_999", email: "missing@example.com" },
      tenants: [tenant],
      users: [],
    });

    await expect(
      requireStaff(ctx as never, "demo", {
        workosUserId: "user_999",
        email: "missing@example.com",
      })
    ).rejects.toSatisfy((error: unknown) => {
        expectConvexCode(error, "user_not_linked_to_tenant");
        return true;
      });
  });

  it("rejects insufficient roles explicitly", async () => {
    const ctx = createCtx({
      identity: { subject: "user_123", email: "requester@example.com" },
      tenants: [tenant],
      users: [
        {
          _id: "user_1",
          tenantId: tenant._id,
          workosUserId: "user_123",
          email: "requester@example.com",
          role: "Requester",
        },
      ],
    });

    await expect(
      requireStaff(ctx as never, "demo", {
        workosUserId: "user_123",
        email: "requester@example.com",
      })
    ).rejects.toSatisfy((error: unknown) => {
        expectConvexCode(error, "insufficient_role");
        return true;
      });
  });
});
