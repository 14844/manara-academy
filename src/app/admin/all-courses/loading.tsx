import { TablePageSkeleton } from "@/components/skeletons";

export default function AdminAllCoursesLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <TablePageSkeleton rowCount={10} />
    </div>
  );
}
