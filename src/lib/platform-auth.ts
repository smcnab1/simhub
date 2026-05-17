import { WorkOS } from "@workos-inc/node";
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
      metadata?: Record<string, unknown>;
      customMetadata?: Record<string, unknown>;
      custom_metadata?: Record<string, unknown>;
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

async function fetchCurrentWorkOSUser(userId?: string) {
  if (!userId || !process.env.WORKOS_API_KEY) {
    return null;
  }

  try {
    const workos = new WorkOS(process.env.WORKOS_API_KEY);
    return await workos.userManagement.getUser(userId);
  } catch (error) {
    console.warn("[platform-auth] Could not refresh WorkOS user metadata", {
      userId,
      error,
    });
    return null;
  }
}

export async function getPlatformAccess(): Promise<PlatformAccess> {
  const session = await getCurrentUser();

  if (!session?.user) {
    redirect("/auth/sign-in?returnTo=/dev");
  }

  const workosUser = session.user as {
    id?: string;
    email?: string;
    metadata?: Record<string, unknown>;
  };
  let role = roleFromWorkOS({
    user: session.user,
    role: session.role,
    roles: session.roles,
  });
  let currentUser = session.user;

  if (!canAccessDeveloper(role)) {
    const refreshedUser = await fetchCurrentWorkOSUser(workosUser.id);
    if (refreshedUser) {
      currentUser = refreshedUser;
      role = roleFromWorkOS({
        user: refreshedUser,
        metadata: refreshedUser.metadata,
        role: session.role,
        roles: session.roles,
      });
    }
  }

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
        metadata: currentUser?.metadata,
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
