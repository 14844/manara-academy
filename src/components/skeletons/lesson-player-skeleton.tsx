import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

export function LessonPlayerSkeleton() {
    return (
        <div className="min-h-screen bg-background font-arabic flex flex-col animate-in fade-in duration-300">
            {/* Top Bar Skeleton */}
            <header className="h-16 border-b px-6 flex items-center justify-between bg-card shrink-0">
                <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <Skeleton className="h-5 w-48 rounded-md" />
                </div>
                <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-28 rounded-xl" />
                    <Skeleton className="h-9 w-9 rounded-xl" />
                </div>
            </header>

            {/* Main Stage & Sidebar Grid */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 overflow-hidden">
                {/* Video Stage (3 cols) */}
                <div className="lg:col-span-3 p-4 md:p-6 flex flex-col space-y-4 overflow-y-auto">
                    {/* 16:9 Video Box Skeleton */}
                    <div className="w-full aspect-video rounded-3xl bg-zinc-900 border border-zinc-800 relative flex items-center justify-center overflow-hidden shadow-2xl">
                        <Skeleton className="h-16 w-16 rounded-full opacity-60" />
                    </div>

                    {/* Lesson Title & Controls Skeleton */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
                        <div className="space-y-2 flex-1">
                            <Skeleton className="h-7 w-3/4 rounded-xl" />
                            <Skeleton className="h-4 w-1/2 rounded-md" />
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            <Skeleton className="h-10 w-28 rounded-xl" />
                            <Skeleton className="h-10 w-28 rounded-xl" />
                        </div>
                    </div>

                    {/* Lesson tabs (Attachments, Notes, Q&A) */}
                    <div className="pt-4 space-y-4">
                        <div className="flex gap-2 border-b pb-3">
                            <Skeleton className="h-9 w-24 rounded-lg" />
                            <Skeleton className="h-9 w-24 rounded-lg" />
                            <Skeleton className="h-9 w-24 rounded-lg" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-full rounded-md" />
                            <Skeleton className="h-4 w-4/5 rounded-md" />
                        </div>
                    </div>
                </div>

                {/* Right Sidebar Syllabus (1 col) */}
                <aside className="lg:col-span-1 border-r border-t lg:border-t-0 bg-muted/10 p-4 space-y-4 overflow-y-auto">
                    <div className="flex items-center justify-between pb-2 border-b">
                        <Skeleton className="h-5 w-32 rounded-md" />
                        <Skeleton className="h-4 w-16 rounded-md" />
                    </div>
                    <div className="space-y-3">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <Card key={i} className="p-3.5 rounded-2xl border shadow-sm space-y-2">
                                <div className="flex items-center justify-between">
                                    <Skeleton className="h-4 w-3/4 rounded-md" />
                                    <Skeleton className="h-4 w-10 rounded-md" />
                                </div>
                                <Skeleton className="h-3 w-1/2 rounded-md" />
                            </Card>
                        ))}
                    </div>
                </aside>
            </div>
        </div>
    )
}
