import { SettingsSkeleton } from "@/components/skeletons";

export default function StudentProfileLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <SettingsSkeleton />
    </div>
  );
}
