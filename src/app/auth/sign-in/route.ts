import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

function getSafeReturnTo(request: NextRequest) {
  const returnTo = request.nextUrl.searchParams.get("returnTo") || "/dashboard";
  const url = new URL(returnTo, request.url);
  return url.origin === request.nextUrl.origin ? `${url.pathname}${url.search}` : "/dashboard";
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();

  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith("wos-auth-verifier")) {
      cookieStore.delete(cookie.name);
    }
  }

  redirect(await getSignInUrl({ returnTo: getSafeReturnTo(request) }));
}
