import { NotAllowed } from "@/components/not-allowed";
import { PlatformDevShell } from "@/components/platform/platform-dev-shell";
import { getPlatformAccess } from "@/lib/platform-auth";

export const dynamic = "force-dynamic";

export default async function PlatformDevLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getPlatformAccess();

  if (!access.ok) {
    return (
      <main className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <NotAllowed
          title="Platform Developer access required"
          message="You are signed in, but this account is not a platform Developer. Ask a platform owner to grant Developer access before using root-domain tools."
        />
      </main>
    );
  }

  return <PlatformDevShell>{children}</PlatformDevShell>;
}
