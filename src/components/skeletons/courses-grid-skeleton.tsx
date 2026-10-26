import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

export function CoursesGridSkeleton({ count = 6 }: { count?: number } = {}) {
    return (
        <div className="container py-8 space-y-8 font-arabic animate-in fade-in duration-300">
            {/* Header / Search Skeleton */}
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2">
                        <Skeleton className="h-9 w-56 rounded-2xl" />
                        <Skeleton className="h-4 w-72 rounded-lg" />
                    </div>
                    <Skeleton className="h-11 w-full md:w-80 rounded-2xl" />
                </div>

                {/* Filter tags skeleton */}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Skeleton key={i} className="h-9 w-24 rounded-full" />
                    ))}
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: count }).map((_, i) => (
                    <Card key={i} className="rounded-3xl border shadow-sm overflow-hidden flex flex-col bg-card">
                        <Skeleton className="w-full aspect-video" />
                        <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                            <div className="space-y-2.5">
                                <div className="flex justify-between items-center">
                                    <Skeleton className="h-5 w-20 rounded-full" />
                                    <Skeleton className="h-4 w-12 rounded-md" />
                                </div>
                                <Skeleton className="h-6 w-full rounded-lg" />
                                <Skeleton className="h-4 w-4/5 rounded-md" />
                            </div>

                            <div className="pt-4 border-t space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Skeleton className="h-7 w-7 rounded-full" />
                                        <Skeleton className="h-4 w-24 rounded-md" />
                                    </div>
                                    <Skeleton className="h-6 w-16 rounded-md" />
                                </div>
                                <Skeleton className="h-10 w-full rounded-xl" />
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    )
}
