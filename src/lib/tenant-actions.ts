"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../convex/_generated/api";
import { getCurrentUser } from "@/lib/auth";
import { canAccessStaff } from "@/lib/authz-logic";
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
  const membership = memberships.find(
    (item) => item.tenantSlug === tenantSlug && canAccessStaff(item.role)
  );

  if (!membership) {
    redirect("/auth/access");
  }

  const cookieStore = await cookies();
  cookieStore.set(TENANT_COOKIE_NAME, membership.tenantSlug, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
  redirect("/dashboard");
}
