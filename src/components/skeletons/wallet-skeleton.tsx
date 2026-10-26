import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export function WalletSkeleton() {
    return (
        <div className="container py-8 space-y-8 font-arabic animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48 rounded-xl" />
                    <Skeleton className="h-4 w-72 rounded-md" />
                </div>
                <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-32 rounded-xl" />
                </div>
            </div>

            {/* Wallet Balance Hero Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-2 rounded-3xl border shadow-sm p-6 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent relative overflow-hidden">
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <Skeleton className="h-5 w-32 rounded-md" />
                            <Skeleton className="h-8 w-8 rounded-full" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-12 w-48 rounded-2xl" />
                            <Skeleton className="h-4 w-60 rounded-md" />
                        </div>
                        <div className="flex flex-wrap gap-3 pt-2">
                            <Skeleton className="h-11 w-36 rounded-xl" />
                            <Skeleton className="h-11 w-36 rounded-xl" />
                        </div>
                    </div>
                </Card>

                <Card className="rounded-3xl border shadow-sm p-6 space-y-4">
                    <Skeleton className="h-5 w-28 rounded-md" />
                    <div className="space-y-3">
                        <div className="flex justify-between items-center py-2 border-b">
                            <Skeleton className="h-4 w-24 rounded-md" />
                            <Skeleton className="h-4 w-16 rounded-md" />
                        </div>
                        <div className="flex justify-between items-center py-2 border-b">
                            <Skeleton className="h-4 w-28 rounded-md" />
                            <Skeleton className="h-4 w-20 rounded-md" />
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <Skeleton className="h-4 w-20 rounded-md" />
                            <Skeleton className="h-4 w-16 rounded-md" />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Transactions History Table Skeleton */}
            <Card className="rounded-3xl border shadow-sm overflow-hidden">
                <CardHeader className="border-b p-5 bg-muted/20">
                    <div className="flex justify-between items-center">
                        <Skeleton className="h-6 w-40 rounded-lg" />
                        <Skeleton className="h-9 w-28 rounded-xl" />
                    </div>
                </CardHeader>
                <CardContent className="p-0 divide-y">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="p-4 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <Skeleton className="h-10 w-10 rounded-2xl shrink-0" />
                                <div className="space-y-1.5">
                                    <Skeleton className="h-4 w-44 rounded-md" />
                                    <Skeleton className="h-3 w-28 rounded-md" />
                                </div>
                            </div>
                            <div className="text-left space-y-1.5">
                                <Skeleton className="h-5 w-20 rounded-md ml-auto" />
                                <Skeleton className="h-4 w-14 rounded-full ml-auto" />
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    )
}
