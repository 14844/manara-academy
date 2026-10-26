import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export function TablePageSkeleton({
    title = true,
    filterCount = 4,
    rowCount = 7
}: {
    title?: boolean
    filterCount?: number
    rowCount?: number
}) {
    return (
        <div className="space-y-6 font-arabic animate-in fade-in duration-300">
            {/* Header Skeleton */}
            {title && (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-60 rounded-xl" />
                        <Skeleton className="h-4 w-80 rounded-md" />
                    </div>
                    <div className="flex items-center gap-2.5">
                        <Skeleton className="h-10 w-28 rounded-xl" />
                        <Skeleton className="h-10 w-28 rounded-xl" />
                    </div>
                </div>
            )}

            {/* Filters Bar */}
            <Card className="border shadow-sm rounded-2xl">
                <CardContent className="p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                        {Array.from({ length: filterCount }).map((_, i) => (
                            <Skeleton key={i} className="h-10 w-full rounded-xl" />
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Table Card Skeleton */}
            <Card className="border shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="p-4 border-b bg-muted/20">
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-5 w-36 rounded-md" />
                        <Skeleton className="h-5 w-24 rounded-md" />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y">
                        {/* Table Header skeleton */}
                        <div className="p-4 bg-muted/40 grid grid-cols-12 gap-4 items-center">
                            <Skeleton className="h-4 col-span-3 rounded-md" />
                            <Skeleton className="h-4 col-span-2 rounded-md" />
                            <Skeleton className="h-4 col-span-2 rounded-md" />
                            <Skeleton className="h-4 col-span-2 rounded-md" />
                            <Skeleton className="h-4 col-span-2 rounded-md" />
                            <Skeleton className="h-4 col-span-1 rounded-md" />
                        </div>

                        {/* Table Rows skeleton */}
                        {Array.from({ length: rowCount }).map((_, i) => (
                            <div key={i} className="p-4 grid grid-cols-12 gap-4 items-center">
                                <div className="col-span-3 flex items-center gap-3">
                                    <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                                    <div className="space-y-1.5 flex-1">
                                        <Skeleton className="h-4 w-3/4 rounded-md" />
                                        <Skeleton className="h-3 w-1/2 rounded-md" />
                                    </div>
                                </div>
                                <div className="col-span-2">
                                    <Skeleton className="h-4 w-24 rounded-md" />
                                </div>
                                <div className="col-span-2">
                                    <Skeleton className="h-6 w-20 rounded-full" />
                                </div>
                                <div className="col-span-2">
                                    <Skeleton className="h-4 w-16 rounded-md" />
                                </div>
                                <div className="col-span-2">
                                    <Skeleton className="h-4 w-20 rounded-md" />
                                </div>
                                <div className="col-span-1 flex justify-end">
                                    <Skeleton className="h-8 w-8 rounded-lg" />
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Pagination Skeleton */}
            <div className="flex items-center justify-between pt-2">
                <Skeleton className="h-4 w-32 rounded-md" />
                <div className="flex items-center gap-2">
                    <Skeleton className="h-9 w-20 rounded-xl" />
                    <Skeleton className="h-9 w-9 rounded-xl" />
                    <Skeleton className="h-9 w-9 rounded-xl" />
                    <Skeleton className="h-9 w-20 rounded-xl" />
                </div>
            </div>
        </div>
    )
}

export const TableSkeleton = TablePageSkeleton
