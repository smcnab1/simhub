import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../convex/_generated/api";
import { DashboardAuthProvider } from "@/components/dashboard-auth";
import { DashboardNav, DashboardTopbar } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { TENANT_SLUG } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentUser();

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const workosUser = session.user as { id?: string; email?: string };
  const authIdentity = {
    workosUserId: workosUser.id,
    email: workosUser.email,
    workosOrganizationId: session.organizationId,
  };
  const memberships = await fetchQuery(api.tenants.listMembershipsForAuth, {
    auth: authIdentity,
  });
  const cookieStore = await cookies();
  const selectedSlug =
    cookieStore.get("simhub-tenant-slug")?.value || TENANT_SLUG;
  const selectedMembership =
    memberships.find((membership) => membership.tenantSlug === selectedSlug) ??
    memberships.find((membership) => membership.role === "Admin" || membership.role === "Staff");

  if (
    !selectedMembership ||
    (selectedMembership.role !== "Admin" && selectedMembership.role !== "Staff")
  ) {
    redirect("/auth/access");
  }

  const auth = {
    ...authIdentity,
    tenantSlug: selectedMembership.tenantSlug,
    tenantName: selectedMembership.tenantName,
    role: selectedMembership.role,
  };

  return (
    <DashboardAuthProvider auth={auth}>
      <div className="min-h-screen lg:pl-72">
        <DashboardNav />
        <div className="min-w-0">
          <DashboardTopbar />
          <main className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </DashboardAuthProvider>
  );
}
