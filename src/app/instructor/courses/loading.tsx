import { CoursesGridSkeleton } from "@/components/skeletons";

export default function InstructorCoursesLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <CoursesGridSkeleton count={6} />
    </div>
  );
}
