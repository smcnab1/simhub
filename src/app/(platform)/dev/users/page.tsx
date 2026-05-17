import { fetchQuery } from "convex/nextjs";
import { api } from "../../../../../convex/_generated/api";
import { PlatformDevPage } from "@/components/platform/platform-dev-page";
import { requirePlatformDeveloper } from "@/lib/platform-auth";

export default async function PlatformUsersPage() {
  const auth = await requirePlatformDeveloper();
  const users = await fetchQuery(api.tenants.listPlatformUsers, { auth });

  return (
    <PlatformDevPage
      title="Platform Users"
      description="Cross-tenant user inventory for platform Developer support."
      activeHref="/dev/users"
    >
      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="grid grid-cols-[1.3fr_1fr_0.8fr_1fr] gap-3 border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>User</span>
          <span>Tenant</span>
          <span>Role</span>
          <span>WorkOS</span>
        </div>
        {users.map((user) => (
          <div
            key={user.userId}
            className="grid grid-cols-[1.3fr_1fr_0.8fr_1fr] gap-3 border-b border-border px-4 py-3 text-sm last:border-b-0"
          >
            <span className="min-w-0 truncate">{user.email}</span>
            <span className="min-w-0 truncate">{user.tenantSlug ?? "Unknown"}</span>
            <span>{user.role}</span>
            <span className="min-w-0 truncate text-muted-foreground">
              {user.workosUserId}
            </span>
          </div>
        ))}
      </section>
    </PlatformDevPage>
  );
}
