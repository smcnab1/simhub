import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardTargetForUser } from "@/lib/dashboard-target";
import { tenantAwareHref } from "@/lib/tenant-url";

export async function getTenantAwareLinkFor({
  tenantFromQuery,
  selectedTenantSlug,
}: {
  tenantFromQuery?: string | null;
  selectedTenantSlug?: string | null;
} = {}) {
  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") ??
    headerStore.get("host") ??
    "";

  return (path: string) =>
    tenantAwareHref(path, {
      host,
      tenantFromQuery,
      selectedTenantSlug,
    });
}

export async function getPublicDashboardHref() {
  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") ??
    headerStore.get("host") ??
    "";
  const session = await getCurrentUser();

  if (!session?.user) {
    return "/auth/dashboard";
  }

  const workosUser = session.user as { id?: string; email?: string };
  const target = await getDashboardTargetForUser(
    {
      user: workosUser,
      workosUserId: workosUser.id,
      email: workosUser.email,
      workosOrganizationId: session.organizationId,
      role: session.role,
      roles: session.roles,
    },
    host
  );

  return target.href;
}
