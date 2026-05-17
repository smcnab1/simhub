import { fetchQuery } from "convex/nextjs";
import { api } from "../../../../../convex/_generated/api";
import { PlatformDevPage } from "@/components/platform/platform-dev-page";
import {
  updatePlatformTenantAction,
} from "@/lib/platform-actions";
import { requirePlatformDeveloper } from "@/lib/platform-auth";
import { TenantProvisioningForm } from "@/components/platform/tenant-provisioning-form";

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
        <h2 className="text-base font-semibold text-foreground">Create Tenant</h2>
        <div className="mt-4">
          <TenantProvisioningForm />
        </div>
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
