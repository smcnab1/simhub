import { WorkOS } from "@workos-inc/node";
import type {
  Invitation,
  Organization,
  OrganizationMembership,
  User,
} from "@workos-inc/node";
import type { Role } from "@/lib/domain";

let workosClient: WorkOS | null = null;

function getWorkOS() {
  if (!process.env.WORKOS_API_KEY) {
    throw new Error("WORKOS_API_KEY is required for tenant provisioning.");
  }

  if (!workosClient) {
    workosClient = new WorkOS(process.env.WORKOS_API_KEY);
  }

  return workosClient;
}

function notFound(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: unknown }).status === 404
  );
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const [firstName, ...rest] = parts;

  return {
    firstName: firstName || undefined,
    lastName: rest.join(" ") || undefined,
  };
}

function tenantExternalId(slug: string) {
  return `simhq:tenant:${slug}`;
}

function roleSlug(role: Role) {
  return role.toLowerCase();
}

export type EnsuredWorkOSOrg = {
  organization: Organization;
  created: boolean;
};

export type EnsuredWorkOSUser =
  | {
      kind: "user";
      user: User;
      created: boolean;
    }
  | {
      kind: "invitation";
      invitation: Invitation;
      created: boolean;
    };

export type EnsuredWorkOSMembership = {
  membership: OrganizationMembership | null;
  created: boolean;
  updated: boolean;
};

export async function ensureWorkOSOrg(input: {
  tenantName: string;
  tenantSlug: string;
  workosOrganizationId?: string;
}) {
  const workos = getWorkOS();
  const metadata = { simhqTenantSlug: input.tenantSlug };

  if (input.workosOrganizationId) {
    try {
      const organization = await workos.organizations.getOrganization(
        input.workosOrganizationId
      );

      if (organization.name !== input.tenantName) {
        return {
          organization: await workos.organizations.updateOrganization({
            organization: organization.id,
            name: input.tenantName,
            metadata,
          }),
          created: false,
        } satisfies EnsuredWorkOSOrg;
      }

      return { organization, created: false } satisfies EnsuredWorkOSOrg;
    } catch (error) {
      if (!notFound(error)) throw error;
    }
  }

  try {
    return {
      organization: await workos.organizations.getOrganizationByExternalId(
        tenantExternalId(input.tenantSlug)
      ),
      created: false,
    } satisfies EnsuredWorkOSOrg;
  } catch (error) {
    if (!notFound(error)) throw error;
  }

  return {
    organization: await workos.organizations.createOrganization(
      {
        name: input.tenantName,
        externalId: tenantExternalId(input.tenantSlug),
        metadata,
      },
      { idempotencyKey: tenantExternalId(input.tenantSlug) }
    ),
    created: true,
  } satisfies EnsuredWorkOSOrg;
}

export async function ensureWorkOSUser(input: {
  email: string;
  name: string;
  organizationId: string;
  role: Role;
  inviterUserId?: string;
  sendInvitation: boolean;
}) {
  const workos = getWorkOS();
  const email = normalizeEmail(input.email);
  const existingUsers = await workos.userManagement.listUsers({
    email,
    limit: 10,
  });
  const existingUser = existingUsers.data.find((user) => user.email === email);

  if (existingUser) {
    return {
      kind: "user",
      user: existingUser,
      created: false,
    } satisfies EnsuredWorkOSUser;
  }

  if (input.sendInvitation) {
    const invitations = await workos.userManagement.listInvitations({
      email,
      organizationId: input.organizationId,
      limit: 10,
    });
    const existingInvitation = invitations.data.find(
      (invitation) =>
        invitation.email === email &&
        invitation.organizationId === input.organizationId &&
        invitation.state === "pending"
    );

    return {
      kind: "invitation",
      invitation:
        existingInvitation ??
        (await workos.userManagement.sendInvitation({
          email,
          organizationId: input.organizationId,
          inviterUserId: input.inviterUserId,
          roleSlug: roleSlug(input.role),
        })),
      created: !existingInvitation,
    } satisfies EnsuredWorkOSUser;
  }

  return {
    kind: "user",
    user: await workos.userManagement.createUser({
      email,
      ...splitName(input.name),
      emailVerified: false,
      metadata: { simhqProvisionedBy: "developer" },
    }),
    created: true,
  } satisfies EnsuredWorkOSUser;
}

export async function ensureMembership(input: {
  organizationId: string;
  userId?: string;
  role: Role;
}) {
  if (!input.userId) {
    return {
      membership: null,
      created: false,
      updated: false,
    } satisfies EnsuredWorkOSMembership;
  }

  const workos = getWorkOS();
  const memberships = await workos.userManagement.listOrganizationMemberships({
    organizationId: input.organizationId,
    userId: input.userId,
    statuses: ["active", "inactive", "pending"],
    limit: 10,
  });
  const existing = memberships.data[0];
  const nextRoleSlug = roleSlug(input.role);

  if (!existing) {
    return {
      membership: await workos.userManagement.createOrganizationMembership({
        organizationId: input.organizationId,
        userId: input.userId,
        roleSlug: nextRoleSlug,
      }),
      created: true,
      updated: false,
    } satisfies EnsuredWorkOSMembership;
  }

  if (existing.role?.slug !== nextRoleSlug) {
    return {
      membership: await workos.userManagement.updateOrganizationMembership(
        existing.id,
        { roleSlug: nextRoleSlug }
      ),
      created: false,
      updated: true,
    } satisfies EnsuredWorkOSMembership;
  }

  return {
    membership: existing,
    created: false,
    updated: false,
  } satisfies EnsuredWorkOSMembership;
}
