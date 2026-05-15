import { DeveloperPage } from "@/components/developer/developer-page";

export default function SystemHealthPage() {
  return (
    <DeveloperPage
      title="System Health"
      description="Monitor platform health checks, service status, and critical dependency state."
      activeHref="/dashboard/developer/health"
    />
  );
}
