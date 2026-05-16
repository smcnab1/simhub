import { DashboardAuthProvider } from "@/components/dashboard-auth";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardTopbar } from "@/components/ui";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getDashboardAccess } from "@/lib/dashboard-access";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const access = await getDashboardAccess();
  const environment =
    process.env.SIMHQ_ENV ??
    process.env.SIMHUB_ENV ??
    process.env.VERCEL_ENV ??
    process.env.NODE_ENV;

  if (!access.ok) {
    return null;
  }

  return (
    <DashboardAuthProvider auth={access.auth}>
      <TooltipProvider>
        <SidebarProvider>
          <AppSidebar auth={access.auth} environment={environment} />
          <SidebarInset>
            <DashboardTopbar />
            <main className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </DashboardAuthProvider>
  );
}
