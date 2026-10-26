import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function SettingsSkeleton() {
  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-72" />
      </div>

      {/* Profile Card */}
      <Card className="border border-border/50 shadow-sm">
        <CardHeader className="flex flex-row items-center gap-4 pb-4">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-10 w-28 rounded-lg" />
        </CardHeader>
      </Card>

      {/* Settings Sections */}
      {[1, 2, 3].map((section) => (
        <Card key={section} className="border border-border/50 shadow-sm">
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-6">
            {[1, 2, 3].map((field) => (
              <div key={field} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ))}
            <div className="flex justify-end pt-2">
              <Skeleton className="h-10 w-32 rounded-lg" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
