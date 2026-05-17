import "server-only";

import { SignJWT } from "jose";
import type { DashboardAuth } from "@/components/dashboard-auth";
import {
  createFeaturebaseMetadata,
  type FeaturebaseClientIdentity,
  type FeaturebaseMetadata,
} from "@/lib/featurebase";
import { displayNameFromUser } from "@/lib/user-display";

type FeaturebaseJwtPayload = {
  userId: string;
  email: string;
  name?: string;
  companies: Array<{
    id: string;
    companyId: string;
    name: string;
  }>;
} & FeaturebaseMetadata;

export async function createFeaturebaseIdentity({
  auth,
  appVersion,
  environment,
}: {
  auth: DashboardAuth;
  appVersion: string;
  environment: string;
}): Promise<FeaturebaseClientIdentity | null> {
  const secret = process.env.FEATUREBASE_JWT_SECRET?.trim();
  const userId = auth.workosUserId ?? auth.email;
  const email = auth.email;
  const name = displayNameFromUser(auth.user ?? { email: auth.email });
  const metadata = createFeaturebaseMetadata({ auth, appVersion, environment });

  if (secret && userId && email) {
    const payload: FeaturebaseJwtPayload = {
      ...metadata,
      userId,
      email,
      ...(name ? { name } : {}),
      companies: [
        {
          id: metadata.tenantSlug,
          companyId: metadata.tenantSlug,
          name: metadata.tenantName,
        },
      ],
    };

    if (process.env.NODE_ENV !== "production") {
      console.info("[featurebase] signing JWT", {
        userIdPresent: Boolean(payload.userId),
        emailPresent: Boolean(payload.email),
        tenantSlug: payload.tenantSlug,
        env: payload.env,
        companyId: payload.companies[0]?.companyId,
      });
    }

    const featurebaseJwt = await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .sign(new TextEncoder().encode(secret));

    return {
      featurebaseJwt,
    };
  }

  if (process.env.NODE_ENV !== "production") {
    console.warn("[featurebase] JWT not created", {
      hasSecret: Boolean(secret),
      hasUserId: Boolean(userId),
      hasEmail: Boolean(email),
    });
  }

  return null;
}
