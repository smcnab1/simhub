import { redirect } from "next/navigation";
import { DashboardNav, DashboardTopbar } from "@/components/ui";
import { canUseDashboard, getCurrentUser, roleFromWorkOS } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentUser();
  const role = roleFromWorkOS(session);
  const enforceAuth = process.env.WORKOS_CLIENT_ID && process.env.WORKOS_API_KEY && process.env.WORKOS_COOKIE_PASSWORD;

  if (enforceAuth && !session?.user) {
    redirect("/auth/sign-in");
  }

  if (enforceAuth && session?.user && !canUseDashboard(role)) {
    redirect("/");
  }

  return (
    <div className="min-h-screen lg:pl-72">
      <DashboardNav />
      <div className="min-w-0">
        <DashboardTopbar />
        <main className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
