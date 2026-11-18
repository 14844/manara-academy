import { CourseDetailsSkeleton } from "@/components/skeletons";

export default function CourseDetailsLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <CourseDetailsSkeleton />
    </div>
  );
}
