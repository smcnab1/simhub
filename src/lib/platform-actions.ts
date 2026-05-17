"use server";

import { revalidatePath } from "next/cache";
import { fetchMutation } from "convex/nextjs";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { requirePlatformDeveloper } from "@/lib/platform-auth";

function optionalString(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  return value || undefined;
}

function optionalNumber(formData: FormData, name: string) {
  const value = optionalString(formData, name);
  return value ? Number(value) : undefined;
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
