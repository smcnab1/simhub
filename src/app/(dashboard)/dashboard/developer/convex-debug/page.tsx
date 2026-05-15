import { DeveloperPage } from "@/components/developer/developer-page";

export default function ConvexDebugPage() {
  return (
    <DeveloperPage
      title="Convex Debug Tools"
      description="Developer-only diagnostics for Convex functions, data, and deployment state."
      activeHref="/dashboard/developer/convex-debug"
    />
  );
}
