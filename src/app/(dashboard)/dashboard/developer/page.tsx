import { DeveloperPage } from "@/components/developer/developer-page";

export default function DeveloperDashboardPage() {
  return (
    <DeveloperPage
      title="Developer Dashboard"
      description="Platform owner overview for tenant operations, system diagnostics, and developer-only actions."
      activeHref="/dashboard/developer"
    />
  );
}
