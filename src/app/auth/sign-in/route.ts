import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { getAuthCallbackUrl, getSafeReturnPath } from "@/lib/auth-redirects";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();

  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith("wos-auth-verifier")) {
      cookieStore.delete(cookie.name);
    }
  }

  redirect(
    await getSignInUrl({
      returnTo: getSafeReturnPath(request),
      redirectUri: getAuthCallbackUrl(request),
    })
  );
}
