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

function simhqEnv(name) {
  const legacyName = name.replace(/^SIMHQ_/, "SIMHUB_");
  const legacyPublicName = name.replace(/^NEXT_PUBLIC_SIMHQ_/, "NEXT_PUBLIC_SIMHUB_");
  return process.env[name] ?? process.env[legacyName] ?? process.env[legacyPublicName];
}

function seedArgs() {
  const tenantSlug =
    optional(simhqEnv("SIMHQ_SEED_TENANT_SLUG")) ||
    optional(simhqEnv("NEXT_PUBLIC_SIMHQ_TENANT_SLUG")) ||
    "university-of-nothing";

  return {
    tenant: {
      name: optional(simhqEnv("SIMHQ_SEED_TENANT_NAME")) ||
        "University of Nothing",
      slug: tenantSlug,
      timezone: optional(simhqEnv("SIMHQ_SEED_TIMEZONE")) || "Europe/London",
      contactEmail: optional(simhqEnv("SIMHQ_SEED_CONTACT_EMAIL")),
      notificationEmails: optional(simhqEnv("SIMHQ_SEED_NOTIFICATION_EMAILS"))
        ?.split(",")
        .map((email) => email.trim())
        .filter(Boolean),
      workosOrganizationId: optional(simhqEnv("SIMHQ_SEED_WORKOS_ORG_ID")),
    },
    bootstrapToken: optional(simhqEnv("SIMHQ_BOOTSTRAP_TOKEN")),
    developerEmail: optional(simhqEnv("SIMHQ_DEVELOPER_EMAIL")),
    developerName: optional(simhqEnv("SIMHQ_DEVELOPER_NAME")),
    developerWorkOSUserId: optional(simhqEnv("SIMHQ_DEVELOPER_WORKOS_USER_ID")),
    adminEmail: optional(simhqEnv("SIMHQ_SEED_ADMIN_EMAIL")),
    adminName: optional(simhqEnv("SIMHQ_SEED_ADMIN_NAME")),
    adminWorkOSUserId: optional(simhqEnv("SIMHQ_SEED_ADMIN_WORKOS_USER_ID")),
  };
}

function assertNotProduction() {
  const values = [
    process.env.NODE_ENV,
    process.env.VERCEL_ENV,
    simhqEnv("SIMHQ_ENV"),
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
  console.error("Usage: node scripts/simhq-bootstrap.mjs <bootstrap|seed|reset:dev>");
  process.exit(1);
}

assertNotProduction();

if (command === "reset:dev") {
  runConvex("bootstrap:resetDev", {
    confirm: "RESET_LOCAL_DEV",
    environment: optional(simhqEnv("SIMHQ_ENV")) ||
      optional(process.env.NODE_ENV) ||
      "development",
    resetToken: optional(simhqEnv("SIMHQ_DEV_RESET_TOKEN")),
    tenantSlug: optional(simhqEnv("SIMHQ_SEED_TENANT_SLUG")) ||
      optional(simhqEnv("NEXT_PUBLIC_SIMHQ_TENANT_SLUG")) ||
      "university-of-nothing",
  });
}

runConvex("bootstrap:bootstrap", seedArgs());
