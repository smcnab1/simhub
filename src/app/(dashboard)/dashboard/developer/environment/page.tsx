import { DeveloperPage } from "@/components/developer/developer-page";

export default function EnvironmentInfoPage() {
  return (
    <DeveloperPage
      title="Environment Info"
      description="Review runtime environment, deployment metadata, and configured integrations."
      activeHref="/dashboard/developer/environment"
    />
  );
}
