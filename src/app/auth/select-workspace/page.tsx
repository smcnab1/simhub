import { redirect } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../../convex/_generated/api";
import { switchTenant } from "@/lib/tenant-actions";
import { getCurrentUser } from "@/lib/auth";
import { APP_NAME } from "@/lib/config";
import { dashboardHrefForTenant } from "@/lib/dashboard-target";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

function isActiveMembership<T extends object>(membership: T) {
  const lifecycle = membership as { active?: unknown; status?: unknown };
  return lifecycle.active !== false && lifecycle.status !== "inactive";
}

export default async function SelectWorkspacePage() {
  const session = await getCurrentUser();

  if (!session?.user) {
    redirect("/auth/sign-in?returnTo=/auth/select-workspace");
  }

  const workosUser = session.user as { id?: string; email?: string };
  const memberships = await fetchQuery(api.tenants.listMembershipsForAuth, {
    auth: {
      workosUserId: workosUser.id,
      email: workosUser.email,
      workosOrganizationId: session.organizationId,
    },
  });
  const activeMemberships = memberships.filter(isActiveMembership);

  if (activeMemberships.length === 0) {
    redirect("/auth/access");
  }

  if (activeMemberships.length === 1) {
    const headerStore = await headers();
    const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
    redirect(dashboardHrefForTenant(activeMemberships[0].tenantSlug, host));
  }

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-2xl content-center px-4 py-10">
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase text-primary">
          {APP_NAME}
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          Choose a workspace
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account belongs to more than one tenant.
        </p>
        <form action={switchTenant} className="mt-5 grid gap-3">
          <label className="grid gap-1 text-sm font-medium text-foreground">
            Workspace
            <select
              name="tenantSlug"
              className="rounded-md border border-border px-3 py-2"
              defaultValue={activeMemberships[0]?.tenantSlug}
            >
              {activeMemberships.map((membership) => (
                <option key={membership.tenantSlug} value={membership.tenantSlug}>
                  {membership.tenantName} ({membership.role})
                </option>
              ))}
            </select>
          </label>
          <button className="justify-self-start rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            Continue
          </button>
        </form>
      </section>
    </main>
  );
}
