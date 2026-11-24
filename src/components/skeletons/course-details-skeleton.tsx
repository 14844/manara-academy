import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

export function CourseDetailsSkeleton() {
    return (
        <div className="min-h-screen bg-background font-arabic animate-in fade-in duration-300">
            {/* Hero Section Skeleton */}
            <div className="bg-muted/30 border-b py-12 md:py-16">
                <div className="container">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                        <div className="lg:col-span-2 space-y-6">
                            <div className="flex flex-wrap items-center gap-2">
                                <Skeleton className="h-6 w-24 rounded-full" />
                                <Skeleton className="h-6 w-20 rounded-full" />
                                <Skeleton className="h-6 w-28 rounded-full" />
                            </div>
                            <Skeleton className="h-10 md:h-12 w-full max-w-xl rounded-2xl" />
                            <Skeleton className="h-5 w-3/4 rounded-lg" />
                            
                            <div className="flex flex-wrap items-center gap-6 pt-4 border-t">
                                <div className="flex items-center gap-3">
                                    <Skeleton className="h-12 w-12 rounded-full" />
                                    <div className="space-y-1.5">
                                        <Skeleton className="h-4 w-16 rounded-md" />
                                        <Skeleton className="h-4 w-28 rounded-md" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Skeleton className="h-4 w-16 rounded-md" />
                                    <Skeleton className="h-4 w-24 rounded-md" />
                                </div>
                                <div className="space-y-1.5">
                                    <Skeleton className="h-4 w-16 rounded-md" />
                                    <Skeleton className="h-4 w-24 rounded-md" />
                                </div>
                            </div>
                        </div>

                        {/* Sticky Preview Card Skeleton */}
                        <div className="lg:col-span-1">
                            <Card className="rounded-3xl border shadow-xl overflow-hidden">
                                <Skeleton className="w-full aspect-video" />
                                <CardContent className="p-6 space-y-6">
                                    <div className="flex justify-between items-baseline">
                                        <Skeleton className="h-10 w-28 rounded-xl" />
                                        <Skeleton className="h-5 w-16 rounded-md" />
                                    </div>
                                    <Skeleton className="h-12 w-full rounded-2xl" />
                                    <div className="space-y-3 pt-2">
                                        <Skeleton className="h-4 w-full rounded-md" />
                                        <Skeleton className="h-4 w-4/5 rounded-md" />
                                        <Skeleton className="h-4 w-3/4 rounded-md" />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>

            {/* Curriculum & Details Skeleton */}
            <div className="container py-12">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                        <div className="space-y-4">
                            <Skeleton className="h-7 w-44 rounded-xl" />
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-full rounded-md" />
                                <Skeleton className="h-4 w-full rounded-md" />
                                <Skeleton className="h-4 w-3/4 rounded-md" />
                            </div>
                        </div>

                        {/* Syllabus Accordion Skeleton */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <Skeleton className="h-7 w-40 rounded-xl" />
                                <Skeleton className="h-4 w-28 rounded-md" />
                            </div>
                            <div className="space-y-3">
                                {[1, 2, 3, 4].map((i) => (
                                    <Card key={i} className="p-4 rounded-2xl border shadow-sm flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Skeleton className="h-6 w-6 rounded-md" />
                                            <Skeleton className="h-5 w-48 rounded-md" />
                                        </div>
                                        <Skeleton className="h-4 w-16 rounded-md" />
                                    </Card>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
