import { PlatformDevPage } from "@/components/platform/platform-dev-page";
import { platformBootstrapAction } from "@/lib/platform-actions";

export default function PlatformBootstrapPage() {
  return (
    <PlatformDevPage
      title="Seed/Bootstrap Tools"
      description="Bootstrap a first tenant admin, campuses, room types, and rooms using platform Developer auth."
      activeHref="/dev/bootstrap"
    >
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">Bootstrap tenant</h2>
        <form action={platformBootstrapAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <input name="tenantName" placeholder="Tenant name" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <input name="tenantSlug" placeholder="tenant-slug" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <input name="timezone" placeholder="Europe/London" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <input name="contactEmail" placeholder="tenant-admin@example.com" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <input name="workosOrganizationId" placeholder="WorkOS organization ID" className="rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-2" />
          <input name="adminEmail" placeholder="First admin email" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <input name="adminName" placeholder="First admin name" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <input name="adminWorkOSUserId" placeholder="Admin WorkOS user ID" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <input name="developerEmail" placeholder="Developer email" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <button className="md:col-span-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Run bootstrap
          </button>
        </form>
      </section>
    </PlatformDevPage>
  );
}
