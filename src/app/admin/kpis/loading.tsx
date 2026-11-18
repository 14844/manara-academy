import { AnalyticsSkeleton } from "@/components/skeletons";

export default function AdminKPIsLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <AnalyticsSkeleton />
    </div>
  );
}
