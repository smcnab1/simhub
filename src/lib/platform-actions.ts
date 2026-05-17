"use server";

import { revalidatePath } from "next/cache";
import { fetchMutation } from "convex/nextjs";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { requirePlatformDeveloper } from "@/lib/platform-auth";
import {
  ensureMembership,
  ensureWorkOSOrg,
  ensureWorkOSUser,
} from "@/lib/workos-provisioning";
import type { Role } from "@/lib/domain";

export type ProvisionTenantActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  tenantSlug?: string;
};

function optionalString(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  return value || undefined;
}

function optionalNumber(formData: FormData, name: string) {
  const value = optionalString(formData, name);
  return value ? Number(value) : undefined;
}

function requiredString(formData: FormData, name: string, label: string) {
  const value = optionalString(formData, name);

  if (!value) {
    throw new Error(`${label} is required.`);
  }

  return value;
}

function platformTenantFromForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    timezone: optionalString(formData, "timezone"),
    contactEmail: optionalString(formData, "contactEmail"),
    notificationEmails: optionalString(formData, "notificationEmails")
      ?.split(",")
      .map((email) => email.trim())
      .filter(Boolean),
    notificationEmailsEnabled: formData.get("notificationEmailsEnabled") === "on",
    hoursOfOperation: optionalString(formData, "hoursOfOperation"),
    uploadMaxBytes: optionalNumber(formData, "uploadMaxBytes"),
    minimumAdvanceBookingDays: optionalNumber(formData, "minimumAdvanceBookingDays"),
    maximumAdvanceBookingDays: optionalNumber(formData, "maximumAdvanceBookingDays"),
    workosOrganizationId: optionalString(formData, "workosOrganizationId"),
    customDomain: optionalString(formData, "customDomain"),
    active: formData.get("active") !== "off",
  };
}

function roleFromForm(formData: FormData): Role {
  const role = String(formData.get("adminRole") ?? "Admin");

  if (
    role === "Developer" ||
    role === "Admin" ||
    role === "Staff" ||
    role === "Requester"
  ) {
    return role;
  }

  throw new Error("Choose a valid role.");
}

export async function createPlatformTenantAction(formData: FormData) {
  const auth = await requirePlatformDeveloper();

  await fetchMutation(api.tenants.createPlatformTenant, {
    auth,
    tenant: platformTenantFromForm(formData),
  });

  revalidatePath("/dev/tenants");
}

export async function updatePlatformTenantAction(formData: FormData) {
  const auth = await requirePlatformDeveloper();
  const tenantId = String(formData.get("tenantId") ?? "");

  await fetchMutation(api.tenants.updatePlatformTenant, {
    auth,
    tenantId: tenantId as Id<"tenants">,
    tenant: platformTenantFromForm(formData),
  });

  revalidatePath("/dev/tenants");
}

export async function platformBootstrapAction(formData: FormData) {
  const auth = await requirePlatformDeveloper();

  await fetchMutation(api.bootstrap.platformSeed, {
    auth,
    tenant: {
      name: String(formData.get("tenantName") ?? ""),
      slug: String(formData.get("tenantSlug") ?? ""),
      timezone: optionalString(formData, "timezone"),
      contactEmail: optionalString(formData, "contactEmail"),
      workosOrganizationId: optionalString(formData, "workosOrganizationId"),
    },
    adminEmail: optionalString(formData, "adminEmail"),
    adminName: optionalString(formData, "adminName"),
    adminWorkOSUserId: optionalString(formData, "adminWorkOSUserId"),
    developerEmail: optionalString(formData, "developerEmail"),
    developerName: optionalString(formData, "developerName"),
    developerWorkOSUserId: optionalString(formData, "developerWorkOSUserId"),
  });

  revalidatePath("/dev");
  revalidatePath("/dev/tenants");
  revalidatePath("/dev/users");
}

export async function provisionDevTenantAction(
  _previousState: ProvisionTenantActionState,
  formData: FormData
): Promise<ProvisionTenantActionState> {
  const auth = await requirePlatformDeveloper();
  let createdShell:
    | {
        tenantId: Id<"tenants">;
        created: boolean;
      }
    | null = null;

  try {
    const includeInitialAdmin = formData.get("includeInitialAdmin") === "on";
    const tenant = {
      ...platformTenantFromForm(formData),
      name: requiredString(formData, "name", "Tenant name"),
      slug: requiredString(formData, "slug", "Tenant slug"),
      contactEmail:
        optionalString(formData, "contactEmail") ??
        optionalString(formData, "adminEmail"),
    };

    const shell = await fetchMutation(api.tenants.upsertPlatformTenantShell, {
      auth,
      tenant,
    });
    createdShell = { tenantId: shell.tenantId, created: shell.created };

    const org = await ensureWorkOSOrg({
      tenantName: shell.name,
      tenantSlug: shell.slug,
      workosOrganizationId: shell.workosOrganizationId,
    });

    const workosUser = includeInitialAdmin
      ? await ensureWorkOSUser({
          email: requiredString(formData, "adminEmail", "Primary admin email"),
          name: requiredString(formData, "adminName", "Primary admin name"),
          organizationId: org.organization.id,
          role: roleFromForm(formData),
          inviterUserId: auth.workosUserId,
          sendInvitation: formData.get("sendInvitation") === "on",
        })
      : null;
    const membership =
      workosUser?.kind === "user"
        ? await ensureMembership({
            organizationId: org.organization.id,
            userId: workosUser.user.id,
            role: roleFromForm(formData),
          })
        : null;

    await fetchMutation(api.tenants.finishPlatformTenantProvisioning, {
      auth,
      tenantId: shell.tenantId,
      workosOrganizationId: org.organization.id,
      workosOrgCreated: org.created,
      workosUserCreated: workosUser?.kind === "user" ? workosUser.created : false,
      workosInvitationCreated:
        workosUser?.kind === "invitation" ? workosUser.created : false,
      workosMembershipChanged: Boolean(
        membership?.created || membership?.updated
      ),
      user: workosUser
        ? {
            workosUserId:
              workosUser.kind === "user" ? workosUser.user.id : undefined,
            invitationId:
              workosUser.kind === "invitation"
                ? workosUser.invitation.id
                : undefined,
            invitationState:
              workosUser.kind === "invitation"
                ? workosUser.invitation.state
                : undefined,
            email: requiredString(formData, "adminEmail", "Primary admin email"),
            name: requiredString(formData, "adminName", "Primary admin name"),
            role: roleFromForm(formData),
            workosMembershipId: membership?.membership?.id,
          }
        : undefined,
    });

    revalidatePath("/dev");
    revalidatePath("/dev/tenants");
    revalidatePath("/dev/users");

    return {
      status: "success",
      message: includeInitialAdmin
        ? "Tenant and initial admin were provisioned."
        : "Tenant was provisioned.",
      tenantSlug: shell.slug,
    };
  } catch (error) {
    if (createdShell?.created) {
      try {
        await fetchMutation(api.tenants.rollbackPlatformTenantShell, {
          auth,
          tenantId: createdShell.tenantId,
        });
      } catch (rollbackError) {
        console.error("[tenant-provisioning] Rollback failed", rollbackError);
      }
    }

    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Tenant provisioning failed. Check WorkOS and Convex state.",
    };
  }
}
