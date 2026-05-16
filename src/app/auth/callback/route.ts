import { WorkOS } from "@workos-inc/node";
import { sealData, unsealData } from "iron-session";
import { type NextRequest, NextResponse } from "next/server";

type PKCEState = {
  codeVerifier: string;
  returnPathname?: string;
};

function cookieSettings(requestUrl: string) {
  const url = new URL(requestUrl);
  return {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 400,
    path: "/",
    sameSite: "lax" as const,
    secure: url.protocol === "https:",
    // TODO(subdomains): set WORKOS_COOKIE_DOMAIN=.rooms.simhq.app in production
    // if staff sessions should roam across tenant subdomains.
    ...(process.env.WORKOS_COOKIE_DOMAIN ? { domain: process.env.WORKOS_COOKIE_DOMAIN } : {}),
  };
}

function safeReturnUrl(returnPathname: string | undefined, requestUrl: string) {
  const url = new URL(returnPathname || "/dashboard", requestUrl);
  const requestOrigin = new URL(requestUrl).origin;
  return url.origin === requestOrigin ? url : new URL("/dashboard", requestUrl);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  }

  const verifierCookie = request.cookies
    .getAll()
    .find((cookie) => cookie.name.startsWith("wos-auth-verifier") && cookie.value === state);

  if (!verifierCookie) {
    if (request.cookies.has(process.env.WORKOS_COOKIE_NAME || "wos-session")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    console.error("[AuthKit callback error] Missing PKCE verifier cookie for OAuth state");
    return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  }

  const { codeVerifier, returnPathname } = await unsealData<PKCEState>(verifierCookie.value, {
    password: process.env.WORKOS_COOKIE_PASSWORD!,
  });

  const workos = new WorkOS(process.env.WORKOS_API_KEY!);
  const { accessToken, refreshToken, user, impersonator, authenticationMethod } =
    await workos.userManagement.authenticateWithCode({
      clientId: process.env.WORKOS_CLIENT_ID!,
      code,
      codeVerifier,
    });

  const encryptedSession = await sealData(
    { accessToken, refreshToken, user, impersonator, authenticationMethod },
    {
      password: process.env.WORKOS_COOKIE_PASSWORD!,
      ttl: 0,
    },
  );

  const response = NextResponse.redirect(safeReturnUrl(returnPathname, request.url));
  const sessionCookieName = process.env.WORKOS_COOKIE_NAME || "wos-session";
  response.cookies.set(sessionCookieName, encryptedSession, cookieSettings(request.url));

  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("wos-auth-verifier")) {
      response.cookies.set(cookie.name, "", { path: "/", maxAge: 0 });
    }
  }

  return response;
}
