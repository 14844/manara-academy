import { DashboardSkeleton } from "@/components/skeletons";

export default function InstructorDashboardLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <DashboardSkeleton />
    </div>
  );
}
