import { redirect } from "next/navigation";
import { getCurrentUser, roleFromWorkOS } from "@/lib/auth";
import { canAccessDeveloper } from "@/lib/authz-logic";
import type { Role } from "@/lib/domain";

export type PlatformDeveloperAuth = {
  platformRole: "Developer";
  workosUserId?: string;
  email?: string;
  user?: {
    id?: string;
    email?: string;
  };
};

export type PlatformAccess =
  | {
      ok: true;
      auth: PlatformDeveloperAuth;
    }
  | {
      ok: false;
      reason: "insufficient_role";
      role: Role;
      email?: string;
    };

export async function getPlatformAccess(): Promise<PlatformAccess> {
  const session = await getCurrentUser();

  if (!session?.user) {
    redirect("/auth/sign-in?returnTo=/dev");
  }

  const workosUser = session.user as { id?: string; email?: string };
  const role = roleFromWorkOS({
    user: session.user,
    role: session.role,
    roles: session.roles,
  });

  if (!canAccessDeveloper(role)) {
    return {
      ok: false,
      reason: "insufficient_role",
      role,
      email: workosUser.email,
    };
  }

  return {
    ok: true,
    auth: {
      platformRole: "Developer",
      workosUserId: workosUser.id,
      email: workosUser.email,
      user: {
        id: workosUser.id,
        email: workosUser.email,
      },
    },
  };
}

export async function requirePlatformDeveloper() {
  const access = await getPlatformAccess();

  if (!access.ok) {
    throw new Error("Platform Developer access required.");
  }

  return access.auth;
}
