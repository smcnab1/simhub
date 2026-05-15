#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const command = process.argv[2];
const envFiles = [".env.local", ".env"];

for (const file of envFiles) {
  if (!existsSync(file)) continue;

  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    if (!process.env[key]) {
      process.env[key] = valueParts.join("=").replace(/^["']|["']$/g, "");
    }
  }
}

function optional(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function seedArgs() {
  const tenantSlug =
    optional(process.env.SIMHUB_SEED_TENANT_SLUG) ||
    optional(process.env.NEXT_PUBLIC_SIMHUB_TENANT_SLUG) ||
    "university-of-nothing";

  return {
    tenant: {
      name: optional(process.env.SIMHUB_SEED_TENANT_NAME) ||
        "University of Nothing",
      slug: tenantSlug,
      timezone: optional(process.env.SIMHUB_SEED_TIMEZONE) || "Europe/London",
      contactEmail: optional(process.env.SIMHUB_SEED_CONTACT_EMAIL),
      notificationEmails: optional(process.env.SIMHUB_SEED_NOTIFICATION_EMAILS)
        ?.split(",")
        .map((email) => email.trim())
        .filter(Boolean),
      workosOrganizationId: optional(process.env.SIMHUB_SEED_WORKOS_ORG_ID),
    },
    bootstrapToken: optional(process.env.SIMHUB_BOOTSTRAP_TOKEN),
    developerEmail: optional(process.env.SIMHUB_DEVELOPER_EMAIL),
    developerName: optional(process.env.SIMHUB_DEVELOPER_NAME),
    developerWorkOSUserId: optional(process.env.SIMHUB_DEVELOPER_WORKOS_USER_ID),
    adminEmail: optional(process.env.SIMHUB_SEED_ADMIN_EMAIL),
    adminName: optional(process.env.SIMHUB_SEED_ADMIN_NAME),
    adminWorkOSUserId: optional(process.env.SIMHUB_SEED_ADMIN_WORKOS_USER_ID),
  };
}

function assertNotProduction() {
  const values = [
    process.env.NODE_ENV,
    process.env.VERCEL_ENV,
    process.env.SIMHUB_ENV,
  ].map((value) => value?.toLowerCase());
  const deployment = process.env.CONVEX_DEPLOYMENT?.toLowerCase();

  if (values.includes("production") || deployment?.startsWith("prod:")) {
    throw new Error("Refusing to run a dev bootstrap command in production.");
  }
}

function runConvex(functionName, args) {
  const result = spawnSync(
    "npx",
    ["convex", "run", functionName, JSON.stringify(args), "--push"],
    { stdio: "inherit" }
  );

  if (result.error) {
    throw result.error;
  }

  process.exit(result.status ?? 1);
}

if (!["bootstrap", "seed", "reset:dev"].includes(command)) {
  console.error("Usage: node scripts/simhub-bootstrap.mjs <bootstrap|seed|reset:dev>");
  process.exit(1);
}

assertNotProduction();

if (command === "reset:dev") {
  runConvex("bootstrap:resetDev", {
    confirm: "RESET_LOCAL_DEV",
    environment: optional(process.env.SIMHUB_ENV) ||
      optional(process.env.NODE_ENV) ||
      "development",
    resetToken: optional(process.env.SIMHUB_DEV_RESET_TOKEN),
    tenantSlug: optional(process.env.SIMHUB_SEED_TENANT_SLUG) ||
      optional(process.env.NEXT_PUBLIC_SIMHUB_TENANT_SLUG) ||
      "university-of-nothing",
  });
}

runConvex("bootstrap:bootstrap", seedArgs());
