import { DashboardAuthProvider } from "@/components/dashboard-auth";
import { DashboardNav, DashboardTopbar } from "@/components/ui";
import { getDashboardAccess } from "@/lib/dashboard-access";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const access = await getDashboardAccess();

  if (!access.ok) {
    return null;
  }

  return (
    <DashboardAuthProvider auth={access.auth}>
      <div className="min-h-screen lg:pl-72">
        <DashboardNav role={access.auth.role} />
        <div className="min-w-0">
          <DashboardTopbar />
          <main className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </DashboardAuthProvider>
  );
}
