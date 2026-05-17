import type { FeaturebaseSettings } from "featurebase-js";
import type { DashboardAuth } from "@/components/dashboard-auth";

export const FEATUREBASE_APP_ID = process.env.NEXT_PUBLIC_FEATUREBASE_APP_ID;
export const FEATUREBASE_HELP_URL = "https://simhq.featurebase.app/help";
export const FEATUREBASE_FEEDBACK_URL = "https://simhq.featurebase.app";
export const FEATUREBASE_ROADMAP_URL = "https://simhq.featurebase.app/roadmap";
export const FEATUREBASE_CHANGELOG_URL = "https://simhq.featurebase.app/changelog";

export type FeaturebaseTheme = "light" | "dark";

export type FeaturebaseMetadata = {
  tenantSlug: string;
  tenantName: string;
  userRole: string;
  appVersion: string;
  env: string;
};

export type FeaturebaseClientIdentity = {
  featurebaseJwt: string;
};

export function createFeaturebaseMetadata({
  auth,
  appVersion,
  environment,
}: {
  auth: DashboardAuth;
  appVersion: string;
  environment: string;
}): FeaturebaseMetadata {
  return {
    tenantSlug: auth.tenantSlug,
    tenantName: auth.tenantName ?? auth.tenantSlug,
    userRole: auth.role ?? "Member",
    appVersion,
    env: environment,
  };
}

export function createFeaturebaseIdentity({
  identity,
}: {
  identity?: FeaturebaseClientIdentity | null;
}): FeaturebaseSettings {
  if (!identity) return {};

  return { featurebaseJwt: identity.featurebaseJwt };
}

export function openFeaturebaseFeedbackWidget(defaultBoard?: string) {
  if (typeof window === "undefined") return;

  window.postMessage(
    {
      target: "FeaturebaseWidget",
      data: {
        action: "openFeedbackWidget",
        ...(defaultBoard ? { setBoard: defaultBoard } : {}),
      },
    },
    window.location.origin,
  );
}
