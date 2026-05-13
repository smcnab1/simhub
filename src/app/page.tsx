import { HomeLanding } from "@/components/home-landing";
import { PublicNav, PageShell } from "@/components/ui";

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
