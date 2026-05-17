import { DashboardAuthProvider } from "@/components/dashboard-auth";
import { AppSidebar } from "@/components/app-sidebar";
import { FeaturebaseChangelogCard } from "@/components/featurebase-changelog-card";
import { NotAllowed } from "@/components/not-allowed";
import { FeaturebaseProvider } from "@/components/providers/featurebase-provider";
import { DashboardTopbar } from "@/components/ui";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getDashboardAccess } from "@/lib/dashboard-access";
import { createFeaturebaseIdentity } from "@/lib/featurebase-server";
import packageJson from "../../../package.json";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const access = await getDashboardAccess();
  const environment =
    process.env.SIMHQ_ENV ??
    process.env.SIMHUB_ENV ??
    process.env.VERCEL_ENV ??
    process.env.NODE_ENV;

  if (!access.ok) {
    return (
      <main className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <NotAllowed
          title={
            access.reason === "no_membership"
              ? "Workspace access pending"
              : "Dashboard access required"
          }
          message={
            access.reason === "no_membership"
              ? "You are signed in, but this account is not assigned to a SimHQ tenant yet. Ask an admin to add your email to the correct workspace, then sign in again."
              : "Your account is signed in, but it does not have access to this dashboard workspace. Ask an admin to update your role, or switch workspaces from account access."
          }
        />
      </main>
    );
  }

  const appVersion = packageJson.version;
  const featurebaseIdentity = await createFeaturebaseIdentity({
    auth: access.auth,
    appVersion,
    environment: environment ?? "unknown",
  });

  return (
    <DashboardAuthProvider auth={access.auth}>
      <FeaturebaseProvider
        appVersion={appVersion}
        environment={environment ?? "unknown"}
        identity={featurebaseIdentity}
      >
        <FeaturebaseChangelogCard />
        <TooltipProvider>
          <SidebarProvider>
            <AppSidebar auth={access.auth} environment={environment} />
            <SidebarInset>
              <DashboardTopbar selectedTenantSlug={access.auth.tenantSlug} />
              <main className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
            </SidebarInset>
          </SidebarProvider>
        </TooltipProvider>
      </FeaturebaseProvider>
    </DashboardAuthProvider>
  );
}
