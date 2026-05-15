import { DeveloperPage } from "@/components/developer/developer-page";

export default function AuditLogsPage() {
  return (
    <DeveloperPage
      title="Audit Logs"
      description="Review platform-level activity, access events, and administrative changes."
      activeHref="/dashboard/developer/audit-logs"
    />
  );
}
