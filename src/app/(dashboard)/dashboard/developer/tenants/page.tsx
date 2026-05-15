import { DeveloperPage } from "@/components/developer/developer-page";

export default function TenantManagementPage() {
  return (
    <DeveloperPage
      title="Tenant Management"
      description="Create, inspect, and manage tenant workspaces across the platform."
      activeHref="/dashboard/developer/tenants"
    />
  );
}
