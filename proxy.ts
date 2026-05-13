import { authkitProxy } from "@workos-inc/authkit-nextjs";

export default authkitProxy({
  middlewareAuth: {
    enabled: Boolean(process.env.WORKOS_CLIENT_ID),
    unauthenticatedPaths: ["/auth/callback", "/auth/sign-in", "/", "/calendar", "/book", "/requests/:path*"],
  },
});

export const config = {
  matcher: ["/dashboard/:path*"],
};
