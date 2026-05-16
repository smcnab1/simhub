import { DeveloperPage } from "@/components/developer/developer-page";

export default function ApiToolsPage() {
  return (
    <DeveloperPage
      title="API/Test Tools"
      description="Run controlled test calls, inspect API behaviour, and validate integrations."
      activeHref="/dashboard/developer/api-tools"
    />
  );
}
