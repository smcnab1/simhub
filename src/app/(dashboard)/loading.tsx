import { CardSkeletonList, MetricSkeletonGrid } from "@/components/app-state";

export default function DashboardLoading() {
  return (
    <div className="grid gap-6">
      <div>
        <div className="h-4 w-32 animate-pulse rounded-md bg-muted" />
        <div className="mt-2 h-8 w-72 max-w-full animate-pulse rounded-md bg-muted" />
      </div>
      <MetricSkeletonGrid />
      <CardSkeletonList />
    </div>
  );
}
