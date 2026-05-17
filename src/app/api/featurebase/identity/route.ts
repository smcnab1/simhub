import { NextResponse } from "next/server";
import { getDashboardAccess } from "@/lib/dashboard-access";
import { createFeaturebaseIdentity } from "@/lib/featurebase-server";
import packageJson from "../../../../../package.json";

export async function GET() {
  const access = await getDashboardAccess();

  if (!access.ok) {
    return NextResponse.json({ identity: null }, { status: 403 });
  }

  const environment =
    process.env.SIMHQ_ENV ??
    process.env.SIMHUB_ENV ??
    process.env.VERCEL_ENV ??
    process.env.NODE_ENV ??
    "unknown";

  const identity = await createFeaturebaseIdentity({
    auth: access.auth,
    appVersion: packageJson.version,
    environment,
  });

  return NextResponse.json({ identity });
}
