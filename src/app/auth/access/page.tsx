import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../../convex/_generated/api";
import { getCurrentUser } from "@/lib/auth";
import { APP_NAME, TENANT_COOKIE_NAME } from "@/lib/config";

export const dynamic = "force-dynamic";

async function getAccessState() {
  const session = await getCurrentUser();

  if (!session?.user) {
    redirect("/auth/sign-in?returnTo=/auth/access");
  }

  const workosUser = session.user as { id?: string; email?: string };
  const auth = {
    workosUserId: workosUser.id,
    email: workosUser.email,
    workosOrganizationId: session.organizationId,
  };
  let memberships: Awaited<ReturnType<typeof fetchQuery<typeof api.tenants.listMembershipsForAuth>>>;

  try {
    memberships = await fetchQuery(api.tenants.listMembershipsForAuth, {
      auth,
    });
  } catch (error) {
    console.error("[auth/access] Could not load tenant memberships", error);
    memberships = [];
  }

  return { session, auth, memberships };
}

async function selectTenant(formData: FormData) {
  "use server";

  const { memberships } = await getAccessState();
  const tenantSlug = String(formData.get("tenantSlug") ?? "");
  const membership = memberships.find(
    (item) =>
      item.tenantSlug === tenantSlug &&
      (item.role === "Admin" || item.role === "Staff")
  );

  if (!membership) {
    redirect("/auth/access");
  }

  const cookieStore = await cookies();
  cookieStore.set(TENANT_COOKIE_NAME, membership.tenantSlug, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // TODO(subdomains): add domain=.rooms.simhq.app when this selector
    // should persist across tenant subdomains.
    maxAge: 60 * 60 * 24 * 400,
  });
  redirect("/dashboard");
}

export default async function AccessPage() {
  const { memberships } = await getAccessState();
  const dashboardMemberships = memberships.filter(
    (membership) => membership.role === "Admin" || membership.role === "Staff"
  );

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-2xl content-center px-4 py-10">
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase text-primary">
          Account access
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          Choose a {APP_NAME} workspace
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You are signed in with WorkOS. {APP_NAME} still needs a matching Convex
          user record with a Staff or Admin role before the dashboard can load.
        </p>

        {dashboardMemberships.length > 0 ? (
          <form action={selectTenant} className="mt-5 grid gap-3">
            <label className="grid gap-1 text-sm font-medium text-foreground">
              Tenant
              <select
                name="tenantSlug"
                className="rounded-md border border-border px-3 py-2"
                defaultValue={dashboardMemberships[0]?.tenantSlug}
              >
                {dashboardMemberships.map((membership) => (
                  <option
                    key={membership.tenantSlug}
                    value={membership.tenantSlug}
                  >
                    {membership.tenantName} ({membership.role})
                  </option>
                ))}
              </select>
            </label>
            <button className="justify-self-start rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              Continue
            </button>
          </form>
        ) : (
          <div className="mt-5 rounded-md border border-border bg-primary/10 p-4 text-sm text-foreground">
            No Staff or Admin tenant access was found for your WorkOS account.
            Ask a {APP_NAME} admin to add your email to the correct tenant in
            Convex, then sign in again.
          </div>
        )}

        {memberships.length > dashboardMemberships.length ? (
          <div className="mt-5">
            <h2 className="text-sm font-semibold text-foreground">
              Other memberships
            </h2>
            <ul className="mt-2 grid gap-2 text-sm text-muted-foreground">
              {memberships
                .filter(
                  (membership) =>
                    membership.role !== "Admin" && membership.role !== "Staff"
                )
                .map((membership) => (
                  <li key={membership.tenantSlug}>
                    {membership.tenantName}: {membership.role}
                  </li>
                ))}
            </ul>
          </div>
        ) : null}

        <a
          href="/auth/sign-out"
          className="mt-5 inline-flex text-sm font-medium text-muted-foreground hover:text-primary"
        >
          Sign out
        </a>
      </section>
    </main>
  );
}
