import { DeveloperPage } from "@/components/developer/developer-page";

export default function JobsMonitorPage() {
  return (
    <DeveloperPage
      title="Queue/Jobs Monitor"
      description="Inspect background jobs, retries, and operational queue state."
      activeHref="/dashboard/developer/jobs"
    />
  );
}
