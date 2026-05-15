import { NotAllowed } from "@/components/not-allowed";
import { getDashboardAccess } from "@/lib/dashboard-access";

export const dynamic = "force-dynamic";

export default async function DeveloperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getDashboardAccess({ requiredRole: "developer" });

  if (!access.ok) {
    return (
      <NotAllowed
        title="Developer access required"
        message="Only Developer users can access platform tooling, bootstrap actions, system diagnostics, and cross-tenant controls."
      />
    );
  }

  return children;
}
