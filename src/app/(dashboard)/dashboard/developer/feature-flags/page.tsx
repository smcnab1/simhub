import { DeveloperPage } from "@/components/developer/developer-page";

export default function FeatureFlagsPage() {
  return (
    <DeveloperPage
      title="Feature Flags"
      description="Manage staged rollout controls and future feature-gated navigation."
      activeHref="/dashboard/developer/feature-flags"
    />
  );
}
