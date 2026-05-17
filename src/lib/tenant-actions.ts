"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../convex/_generated/api";
import { getCurrentUser } from "@/lib/auth";
import { dashboardHrefForTenant } from "@/lib/dashboard-target";
import { TENANT_COOKIE_NAME } from "@/lib/config";

export async function switchTenant(formData: FormData) {
  const session = await getCurrentUser();

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const workosUser = session.user as { id?: string; email?: string };
  const tenantSlug = String(formData.get("tenantSlug") ?? "");
  const memberships = await fetchQuery(api.tenants.listMembershipsForAuth, {
    auth: {
      workosUserId: workosUser.id,
      email: workosUser.email,
      workosOrganizationId: session.organizationId,
    },
  });
  const membership = memberships.find((item) => item.tenantSlug === tenantSlug);

  if (!membership) {
    redirect("/auth/access");
  }

  const cookieStore = await cookies();
  cookieStore.set(TENANT_COOKIE_NAME, membership.tenantSlug, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // TODO(subdomains): add domain=.rooms.simhq.app when tenant switch state
    // should be shared between tenant subdomains.
    maxAge: 60 * 60 * 24 * 400,
  });
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  redirect(dashboardHrefForTenant(membership.tenantSlug, host));
}
