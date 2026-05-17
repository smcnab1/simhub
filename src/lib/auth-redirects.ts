import { type NextRequest } from "next/server";
import { isAllowedTenantHost, PRODUCT_ROOT_DOMAIN } from "@/lib/tenant-resolver";

export function isAllowedAuthRequestHost(request: NextRequest) {
  return isAllowedTenantHost(
    request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  );
}

export function getAuthRequestOrigin(request: NextRequest) {
  if (!isAllowedAuthRequestHost(request)) {
    return process.env.NODE_ENV === "production"
      ? `https://${PRODUCT_ROOT_DOMAIN}`
      : "http://localhost:3000";
  }

  const protocol =
    request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    request.nextUrl.host;

  return `${protocol}://${host}`;
}

export function getAuthCallbackUrl(request: NextRequest) {
  return `${getAuthRequestOrigin(request)}/auth/callback`;
}

export function getSafeReturnPath(request: NextRequest) {
  const returnTo = request.nextUrl.searchParams.get("returnTo") || "/dashboard";
  const url = new URL(returnTo, request.url);
  return url.origin === request.nextUrl.origin ? `${url.pathname}${url.search}` : "/dashboard";
}

export function getSafeAuthReturnUrl(returnPathname: string | undefined, request: NextRequest) {
  const origin = getAuthRequestOrigin(request);
  const url = new URL(returnPathname || "/dashboard", origin);
  return url.origin === origin ? url : new URL("/dashboard", origin);
}
