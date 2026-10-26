import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-8 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-60" />
          <Skeleton className="h-5 w-80 max-w-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-36 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      </div>

      {/* KPI Stat Cards (4 columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border border-border/50 shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-8 w-32" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-12 rounded-full" />
                <Skeleton className="h-3 w-24" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-8 w-24 rounded-lg" />
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="h-[280px] w-full flex items-end gap-3 px-4 pb-2 border-b border-border/30">
              {[40, 65, 30, 85, 55, 90, 70, 45, 60, 95, 75, 80].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <Skeleton
                    className="w-full rounded-t-md opacity-70"
                    style={{ height: `${h}%` }}
                  />
                  <Skeleton className="h-3 w-6" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Secondary Distribution / Circular Chart */}
        <Card className="border border-border/50 shadow-sm flex flex-col">
          <CardHeader>
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent className="flex-1 flex flex-col items-center justify-center space-y-6">
            <Skeleton className="h-44 w-44 rounded-full" />
            <div className="w-full space-y-2">
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-12" />
              </div>
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-12" />
              </div>
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-12" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown Table Card */}
      <Card className="border border-border/50 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-8 w-24" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5].map((row) => (
            <div
              key={row}
              className="flex items-center justify-between p-3 rounded-lg border border-border/30 bg-muted/20"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
