import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export function DashboardSkeleton() {
    return (
        <div className="container py-8 space-y-8 font-arabic animate-in fade-in duration-300">
            {/* Header Banner Skeleton */}
            <div className="p-6 md:p-8 rounded-3xl border bg-muted/20 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-6 w-24 rounded-full" />
                        <Skeleton className="h-6 w-32 rounded-full" />
                    </div>
                    <Skeleton className="h-9 w-64 md:w-80 rounded-2xl" />
                    <Skeleton className="h-4 w-72 md:w-96 rounded-lg" />
                </div>
                <div className="flex items-center gap-3">
                    <Skeleton className="h-11 w-32 rounded-2xl" />
                    <Skeleton className="h-11 w-11 rounded-full" />
                </div>
            </div>

            {/* Stat Cards Grid Skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="border shadow-sm rounded-2xl overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <Skeleton className="h-4 w-28 rounded-md" />
                            <Skeleton className="h-9 w-9 rounded-xl" />
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Skeleton className="h-8 w-20 rounded-lg" />
                            <Skeleton className="h-3 w-36 rounded-md" />
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Tabs Bar Skeleton */}
            <div className="flex items-center justify-between gap-4 border-b pb-4">
                <div className="flex items-center gap-2">
                    <Skeleton className="h-10 w-28 rounded-xl" />
                    <Skeleton className="h-10 w-28 rounded-xl" />
                    <Skeleton className="h-10 w-28 rounded-xl" />
                </div>
                <Skeleton className="h-10 w-44 rounded-xl hidden md:block" />
            </div>

            {/* Course Cards Grid Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Card key={i} className="rounded-3xl border shadow-sm overflow-hidden flex flex-col">
                        <Skeleton className="w-full aspect-video" />
                        <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Skeleton className="h-5 w-20 rounded-full" />
                                    <Skeleton className="h-4 w-16 rounded-md" />
                                </div>
                                <Skeleton className="h-6 w-full rounded-lg" />
                                <Skeleton className="h-4 w-3/4 rounded-md" />
                            </div>
                            <div className="space-y-3 pt-2">
                                <Skeleton className="h-2 w-full rounded-full" />
                                <div className="flex items-center justify-between pt-2">
                                    <div className="flex items-center gap-2">
                                        <Skeleton className="h-7 w-7 rounded-full" />
                                        <Skeleton className="h-4 w-24 rounded-md" />
                                    </div>
                                    <Skeleton className="h-9 w-24 rounded-xl" />
                                </div>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    )
}
