import { DeveloperPage } from "@/components/developer/developer-page";

export default function SystemSettingsPage() {
  return (
    <DeveloperPage
      title="System Settings"
      description="Platform-level configuration for operators and deployment defaults."
      activeHref="/dashboard/developer/system-settings"
    />
  );
}
