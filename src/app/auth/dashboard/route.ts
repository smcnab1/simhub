import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAuthRequestHost } from "@/lib/auth-redirects";
import { getDashboardTargetForUser } from "@/lib/dashboard-target";

export async function GET(request: NextRequest) {
  const session = await getCurrentUser();

  if (!session?.user) {
    redirect("/auth/sign-in?returnTo=/dashboard");
  }

  const workosUser = session.user as { id?: string; email?: string };
  const target = await getDashboardTargetForUser(
    {
      user: workosUser,
      workosUserId: workosUser.id,
      email: workosUser.email,
      workosOrganizationId: session.organizationId,
      role: session.role,
      roles: session.roles,
    },
    getAuthRequestHost(request)
  );

  redirect(target.href);
}
