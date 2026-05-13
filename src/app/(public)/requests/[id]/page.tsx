import { RequestDetail } from "@/components/request-detail";
import { PublicNav, PageShell } from "@/components/ui";

export default async function RequestTrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <>
      <PublicNav />
      <PageShell>
        <RequestDetail id={id} publicView />
      </PageShell>
    </>
  );
}
