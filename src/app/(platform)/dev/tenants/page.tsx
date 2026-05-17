import { fetchQuery } from "convex/nextjs";
import { api } from "../../../../../convex/_generated/api";
import { PlatformDevPage } from "@/components/platform/platform-dev-page";
import {
  createPlatformTenantAction,
  updatePlatformTenantAction,
} from "@/lib/platform-actions";
import { requirePlatformDeveloper } from "@/lib/platform-auth";

export default async function PlatformTenantsPage() {
  const auth = await requirePlatformDeveloper();
  const tenants = await fetchQuery(api.tenants.listPlatformTenants, { auth });

  return (
    <PlatformDevPage
      title="Tenant Management"
      description="Create, inspect, and update tenant workspaces from the product root domain."
      activeHref="/dev/tenants"
    >
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">Create tenant</h2>
        <form action={createPlatformTenantAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <input name="name" placeholder="Tenant name" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <input name="slug" placeholder="tenant-slug" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <input name="timezone" placeholder="Europe/London" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <input name="contactEmail" placeholder="admin@example.com" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <input name="workosOrganizationId" placeholder="WorkOS organization ID" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <input name="customDomain" placeholder="custom.example.com" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <button className="md:col-span-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Create tenant
          </button>
        </form>
      </section>

      <section className="grid gap-3">
        {tenants.map((tenant) => (
          <form
            key={tenant.tenantId}
            action={updatePlatformTenantAction}
            className="grid gap-3 rounded-lg border border-border bg-card p-4 lg:grid-cols-6"
          >
            <input type="hidden" name="tenantId" value={tenant.tenantId} />
            <input name="name" defaultValue={tenant.name} className="rounded-md border border-input bg-background px-3 py-2 text-sm lg:col-span-2" />
            <input name="slug" defaultValue={tenant.slug} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
            <input name="timezone" defaultValue={tenant.timezone} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
            <input name="contactEmail" defaultValue={tenant.contactEmail} className="rounded-md border border-input bg-background px-3 py-2 text-sm lg:col-span-2" />
            <input name="workosOrganizationId" defaultValue={tenant.workosOrganizationId} className="rounded-md border border-input bg-background px-3 py-2 text-sm lg:col-span-2" />
            <input name="customDomain" defaultValue={tenant.customDomain} className="rounded-md border border-input bg-background px-3 py-2 text-sm lg:col-span-2" />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" name="active" defaultChecked={tenant.active} />
              Active
            </label>
            <button className="rounded-md border border-border px-4 py-2 text-sm font-semibold">
              Update
            </button>
          </form>
        ))}
      </section>
    </PlatformDevPage>
  );
}
