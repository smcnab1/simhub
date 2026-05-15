import { HomeLanding } from "@/components/home-landing";
import { PublicNav, PageShell } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <>
      <PublicNav />
      <PageShell>
        <HomeLanding />
      </PageShell>
    </>
  );
}
