"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    Crown,
    History,
    Loader2,
    RefreshCw,
    Search,
    Users,
    Wallet,
    XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { TablePageSkeleton } from "@/components/skeletons"
import { useAdminRole } from "@/components/admin/admin-role-context"
import { MonthsSelector, monthsLabel, type PlanMonths } from "@/components/plans/months-selector"
import { DEFAULT_PLAN_ID, PLANS, PLAN_LIST, formatRate, isPlanId, type PlanId } from "@/lib/plans"
import { cn } from "@/lib/utils"

type RequestStatus = "pending" | "approved" | "rejected"

interface PlanRequest {
    id: string
    instructor_id: string
    instructor_name: string
    instructor_email: string
    current_plan_id: PlanId | null | undefined
    requested_plan_id: PlanId
    months: number
    amount: number
    status: RequestStatus
    note: string | null
    created_at: string
    reviewed_by: string | null
    reviewed_at: string | null
}

interface InstructorPlanRow {
    id: string
    full_name: string
    email: string
    planId: PlanId
    expiresAt: string | null
    expired: boolean
    commissionRate: number
}

interface SubscriptionsSummary {
    total: number
    count: number
}

/** Missing/unknown plan id => starter (البداية). There is no legacy plan. */
function resolvePlanId(id: unknown): PlanId {
    return isPlanId(id) ? id : DEFAULT_PLAN_ID
}

function planName(id: PlanId | null | undefined): string {
    return PLANS[resolvePlanId(id)].name
}

function formatDate(iso: string | null | undefined): string {
    if (!iso) return "—"
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" })
}

function money(n: number | null | undefined): string {
    return `${(n ?? 0).toLocaleString("ar-EG")} ج.م`
}

function StatusBadge({ status }: { status: RequestStatus }) {
    if (status === "pending") return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/30">قيد المراجعة</Badge>
    if (status === "approved") return <Badge className="bg-green-500/10 text-green-600 border-green-500/30">تمت الموافقة</Badge>
    return <Badge variant="destructive">مرفوض</Badge>
}

type SubsPeriod = "month" | "year" | "all"

const SUBS_PERIOD_LABEL: Record<SubsPeriod, string> = {
    month: "هذا الشهر",
    year: "هذه السنة",
    all: "كل الوقت",
}

function ymd(d: Date): string {
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${d.getFullYear()}-${m}-${day}`
}

function subsRange(period: SubsPeriod): { from: string; to: string } {
    const now = new Date()
    const to = ymd(now)
    if (period === "month") return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to }
    if (period === "year") return { from: ymd(new Date(now.getFullYear(), 0, 1)), to }
    return { from: "2020-01-01", to }
}

function AccessBadge({ on, label }: { on: boolean; label: string }) {
    return (
        <Badge
            variant="outline"
            className={cn(
                "gap-1 font-medium",
                on ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400" : "text-muted-foreground opacity-70",
            )}
        >
            {on ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {label}
        </Badge>
    )
}

export default function AdminPlansPage() {
    const { can } = useAdminRole()
    const canManage = can("plans.manage")
    const canViewFinance = can("finance.view")

    const [subsPeriod, setSubsPeriod] = useState<SubsPeriod>("month")
    const [subs, setSubs] = useState<SubscriptionsSummary | null>(null)
    const [subsLoading, setSubsLoading] = useState(false)

    const [requests, setRequests] = useState<PlanRequest[]>([])
    const [instructors, setInstructors] = useState<InstructorPlanRow[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [search, setSearch] = useState("")
    const [isProcessing, setIsProcessing] = useState(false)

    // Approve dialog
    const [approveReq, setApproveReq] = useState<PlanRequest | null>(null)
    const [approveCharge, setApproveCharge] = useState(false)
    // Reject dialog
    const [rejectReq, setRejectReq] = useState<PlanRequest | null>(null)
    const [rejectNote, setRejectNote] = useState("")
    // Assign dialog
    const [assignFor, setAssignFor] = useState<InstructorPlanRow | null>(null)
    const [assignPlan, setAssignPlan] = useState<PlanId>("pro")
    const [assignMonths, setAssignMonths] = useState<PlanMonths>(1)
    const [assignCharge, setAssignCharge] = useState(false)

    const fetchData = useCallback(async (initial = false) => {
        if (initial) setIsLoading(true)
        else setIsRefreshing(true)
        try {
            const res = await fetch("/api/admin/plans", { cache: "no-store" })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(json.error || "تعذر تحميل بيانات الباقات")
            setRequests(Array.isArray(json.requests) ? json.requests : [])
            setInstructors(Array.isArray(json.instructors) ? json.instructors : [])
        } catch (err: any) {
            toast.error(err?.message || "تعذر تحميل بيانات الباقات")
        } finally {
            setIsLoading(false)
            setIsRefreshing(false)
        }
    }, [])

    useEffect(() => {
        fetchData(true)
    }, [fetchData])

    useEffect(() => {
        if (!canViewFinance) return
        let cancelled = false
        const { from, to } = subsRange(subsPeriod)
        setSubsLoading(true)
        fetch(`/api/admin/finance/commissions?from=${from}&to=${to}`, { cache: "no-store" })
            .then(async (res) => {
                const json = await res.json().catch(() => ({}))
                if (!res.ok) throw new Error(json.error || "تعذر تحميل إيرادات الاشتراكات")
                if (cancelled) return
                const s = json?.subscriptions
                setSubs({ total: Number(s?.total) || 0, count: Number(s?.count) || 0 })
            })
            .catch((err: any) => {
                if (!cancelled) {
                    setSubs(null)
                    toast.error(err?.message || "تعذر تحميل إيرادات الاشتراكات")
                }
            })
            .finally(() => {
                if (!cancelled) setSubsLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [canViewFinance, subsPeriod])

    const pendingRequests = useMemo(
        () => requests.filter((r) => r.status === "pending").sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)),
        [requests],
    )
    const historyRequests = useMemo(
        () =>
            requests
                .filter((r) => r.status !== "pending")
                .sort((a, b) => +new Date(b.reviewed_at || b.created_at) - +new Date(a.reviewed_at || a.created_at)),
        [requests],
    )
    const filteredInstructors = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return instructors
        return instructors.filter(
            (i) => i.full_name?.toLowerCase().includes(q) || i.email?.toLowerCase().includes(q),
        )
    }, [instructors, search])

    const planCounts = useMemo(() => {
        const counts: Record<PlanId, number> = { starter: 0, pro: 0, center: 0 }
        for (const i of instructors) counts[resolvePlanId(i.planId)] += 1
        return counts
    }, [instructors])

    async function postJson(url: string, body: unknown) {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || json.error) throw new Error(json.error || "حدث خطأ أثناء تنفيذ العملية")
        return json
    }

    async function handleApprove() {
        if (!approveReq) return
        setIsProcessing(true)
        try {
            await postJson("/api/admin/plans/assign", {
                instructorId: approveReq.instructor_id,
                planId: approveReq.requested_plan_id,
                months: approveReq.months,
                requestId: approveReq.id,
                chargeWallet: approveCharge,
            })
            toast.success(`تم تفعيل باقة ${planName(approveReq.requested_plan_id)} لـ ${approveReq.instructor_name}`)
            setApproveReq(null)
            fetchData()
        } catch (err: any) {
            toast.error(err?.message || "تعذر الموافقة على الطلب")
        } finally {
            setIsProcessing(false)
        }
    }

    async function handleReject() {
        if (!rejectReq) return
        setIsProcessing(true)
        try {
            await postJson("/api/admin/plans/reject", {
                requestId: rejectReq.id,
                ...(rejectNote.trim() ? { note: rejectNote.trim() } : {}),
            })
            toast.info("تم رفض الطلب")
            setRejectReq(null)
            fetchData()
        } catch (err: any) {
            toast.error(err?.message || "تعذر رفض الطلب")
        } finally {
            setIsProcessing(false)
        }
    }

    async function handleAssign() {
        if (!assignFor) return
        const isFree = PLANS[assignPlan].monthlyPrice === 0
        setIsProcessing(true)
        try {
            await postJson("/api/admin/plans/assign", {
                instructorId: assignFor.id,
                planId: assignPlan,
                ...(isFree ? {} : { months: assignMonths, chargeWallet: assignCharge }),
            })
            toast.success(`تم تعيين باقة ${PLANS[assignPlan].name} لـ ${assignFor.full_name}`)
            setAssignFor(null)
            fetchData()
        } catch (err: any) {
            toast.error(err?.message || "تعذر تعيين الباقة")
        } finally {
            setIsProcessing(false)
        }
    }

    function openAssign(row: InstructorPlanRow) {
        setAssignFor(row)
        const current = resolvePlanId(row.planId)
        setAssignPlan(!row.expired && current !== DEFAULT_PLAN_ID ? current : "pro")
        setAssignMonths(1)
        setAssignCharge(false)
    }

    if (isLoading) return <TablePageSkeleton rowCount={8} />

    const assignIsFree = PLANS[assignPlan].monthlyPrice === 0
    const assignTotal = PLANS[assignPlan].monthlyPrice * assignMonths

    return (
        <div className="space-y-6 font-arabic">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold">باقات المدرسين</h1>
                    <p className="text-muted-foreground">راجع طلبات الاشتراك في الباقات وعيّن باقة لأي مدرس.</p>
                </div>
                <Button variant="outline" className="min-h-11 gap-2" onClick={() => fetchData()} disabled={isRefreshing}>
                    <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} /> تحديث
                </Button>
            </div>

            {!canManage && (
                <div className="flex items-start gap-3 rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 text-sm text-orange-700 dark:text-orange-300">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>عرض فقط — دورك الحالي لا يملك صلاحية إدارة الباقات.</p>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Card className="shadow-sm">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="flex items-center justify-between text-xs text-muted-foreground">
                            طلبات معلقة <Clock className="h-3.5 w-3.5 text-orange-500" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-black text-orange-600">{pendingRequests.length}</div>
                    </CardContent>
                </Card>
                {canViewFinance && (
                    <Card className="shadow-sm">
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                    <Wallet className="h-3.5 w-3.5 text-green-600" /> إيرادات اشتراكات الباقات
                                </span>
                                <div className="flex gap-1" role="group" aria-label="فترة إيرادات الاشتراكات">
                                    {(Object.keys(SUBS_PERIOD_LABEL) as SubsPeriod[]).map((p) => (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => setSubsPeriod(p)}
                                            aria-pressed={subsPeriod === p}
                                            className={cn(
                                                "rounded-md border px-2 py-0.5 text-[11px] transition-colors",
                                                subsPeriod === p ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
                                            )}
                                        >
                                            {SUBS_PERIOD_LABEL[p]}
                                        </button>
                                    ))}
                                </div>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            {subsLoading ? (
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            ) : (
                                <>
                                    <div className="text-2xl font-black text-green-600">{money(subs?.total)}</div>
                                    <p className="text-xs text-muted-foreground">{(subs?.count ?? 0).toLocaleString("ar-EG")} اشتراك مدفوع</p>
                                </>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Plans: rate, access and instructor count */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {PLAN_LIST.map((p) => (
                    <Card key={p.id} className={cn("shadow-sm", p.highlighted && "border-primary/40")}>
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="flex items-center justify-between text-base">
                                <span className="flex items-center gap-1.5">
                                    <Crown className="h-4 w-4 text-primary" /> {p.name}
                                </span>
                                <Badge variant="secondary" className="font-bold">عمولة {formatRate(p.commissionRate)}</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 p-4 pt-0 text-sm">
                            <div className="flex items-end justify-between">
                                <div>
                                    <div className="text-2xl font-black">{planCounts[p.id].toLocaleString("ar-EG")}</div>
                                    <p className="text-xs text-muted-foreground">مدرس على الباقة</p>
                                </div>
                                <p className="text-xs font-bold text-muted-foreground">
                                    {p.monthlyPrice > 0 ? `${money(p.monthlyPrice)} / شهر` : "مجانية"}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                <AccessBadge on={p.access.labs} label="المعامل الافتراضية" />
                                <AccessBadge on={p.access.autoParentReports} label="تقارير أولياء الأمور تلقائياً" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Tabs defaultValue="pending" dir="rtl" className="gap-4">
                <TabsList className="h-auto w-full sm:w-fit">
                    <TabsTrigger value="pending" className="min-h-10 gap-1.5">
                        <Clock className="h-4 w-4" /> الطلبات
                        {pendingRequests.length > 0 && (
                            <span className="rounded-full bg-orange-500 px-1.5 text-[10px] font-bold text-white">
                                {pendingRequests.length}
                            </span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="history" className="min-h-10 gap-1.5">
                        <History className="h-4 w-4" /> السجل
                    </TabsTrigger>
                    <TabsTrigger value="instructors" className="min-h-10 gap-1.5">
                        <Users className="h-4 w-4" /> المدرسين
                    </TabsTrigger>
                </TabsList>

                {/* Pending requests */}
                <TabsContent value="pending" className="space-y-3">
                    {pendingRequests.length === 0 ? (
                        <Card className="border-dashed">
                            <CardContent className="py-12 text-center text-muted-foreground">
                                لا توجد طلبات باقات معلقة حالياً
                            </CardContent>
                        </Card>
                    ) : (
                        pendingRequests.map((req) => (
                            <Card key={req.id} className="shadow-sm">
                                <CardContent className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
                                    <div className="min-w-0 space-y-1">
                                        <p className="font-bold">{req.instructor_name || req.instructor_id}</p>
                                        {req.instructor_email && (
                                            <p className="truncate text-xs text-muted-foreground" dir="ltr">{req.instructor_email}</p>
                                        )}
                                        <p className="text-sm">
                                            <span className="text-muted-foreground">{planName(req.current_plan_id)}</span>
                                            <span className="mx-1.5">←</span>
                                            <span className="font-bold text-primary">{planName(req.requested_plan_id)}</span>
                                            <span className="text-muted-foreground"> · {monthsLabel(req.months)} · </span>
                                            <span className="font-bold">{money(req.amount)}</span>
                                        </p>
                                        <p className="text-xs text-muted-foreground">بتاريخ {formatDate(req.created_at)}</p>
                                    </div>
                                    {canManage && (
                                        <div className="grid grid-cols-2 gap-2 lg:flex lg:shrink-0">
                                            <Button
                                                className="min-h-11 gap-1.5 bg-green-600 hover:bg-green-700"
                                                disabled={isProcessing}
                                                onClick={() => {
                                                    setApproveReq(req)
                                                    setApproveCharge(false)
                                                }}
                                            >
                                                <CheckCircle2 className="h-4 w-4" /> موافقة
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                className="min-h-11 gap-1.5"
                                                disabled={isProcessing}
                                                onClick={() => {
                                                    setRejectReq(req)
                                                    setRejectNote("")
                                                }}
                                            >
                                                <XCircle className="h-4 w-4" /> رفض
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))
                    )}
                </TabsContent>

                {/* History */}
                <TabsContent value="history">
                    <Card className="shadow-sm">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto rounded-xl">
                                <table className="w-full min-w-[720px] text-right text-sm">
                                    <thead className="border-b bg-muted/50">
                                        <tr>
                                            <th className="p-3 font-bold">المدرس</th>
                                            <th className="p-3 font-bold">الباقة</th>
                                            <th className="p-3 font-bold">المدة</th>
                                            <th className="p-3 font-bold">المبلغ</th>
                                            <th className="p-3 font-bold">الحالة</th>
                                            <th className="p-3 font-bold">تاريخ المراجعة</th>
                                            <th className="p-3 font-bold">ملاحظة</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {historyRequests.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="p-10 text-center text-muted-foreground">
                                                    لا يوجد سجل طلبات بعد
                                                </td>
                                            </tr>
                                        ) : (
                                            historyRequests.map((req) => (
                                                <tr key={req.id} className="hover:bg-muted/30">
                                                    <td className="p-3 font-medium">{req.instructor_name || req.instructor_id}</td>
                                                    <td className="p-3">{planName(req.requested_plan_id)}</td>
                                                    <td className="p-3 whitespace-nowrap">{monthsLabel(req.months)}</td>
                                                    <td className="p-3 whitespace-nowrap">{money(req.amount)}</td>
                                                    <td className="p-3"><StatusBadge status={req.status} /></td>
                                                    <td className="p-3 whitespace-nowrap text-muted-foreground">
                                                        {formatDate(req.reviewed_at || req.created_at)}
                                                    </td>
                                                    <td className="p-3 max-w-[220px] truncate text-muted-foreground" title={req.note || ""}>
                                                        {req.note || "—"}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Instructors */}
                <TabsContent value="instructors" className="space-y-3">
                    <div className="relative sm:max-w-sm">
                        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="بحث بالاسم أو البريد..."
                            className="min-h-11 pr-10"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Card className="shadow-sm">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto rounded-xl">
                                <table className="w-full min-w-[640px] text-right text-sm">
                                    <thead className="border-b bg-muted/50">
                                        <tr>
                                            <th className="p-3 font-bold">المدرس</th>
                                            <th className="p-3 font-bold">الباقة</th>
                                            <th className="p-3 font-bold">العمولة</th>
                                            <th className="p-3 font-bold">تنتهي في</th>
                                            {canManage && <th className="p-3 font-bold text-center">إجراء</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {filteredInstructors.length === 0 ? (
                                            <tr>
                                                <td colSpan={canManage ? 5 : 4} className="p-10 text-center text-muted-foreground">
                                                    لا يوجد مدرسين
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredInstructors.map((row) => (
                                                <tr key={row.id} className="hover:bg-muted/30">
                                                    <td className="p-3">
                                                        <p className="font-medium">{row.full_name || "—"}</p>
                                                        <p className="text-xs text-muted-foreground" dir="ltr">{row.email}</p>
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            <span>{planName(row.planId)}</span>
                                                            {row.expired && (
                                                                <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/30">منتهية</Badge>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 font-bold text-primary">{formatRate(row.commissionRate)}</td>
                                                    <td className="p-3 whitespace-nowrap text-muted-foreground">{formatDate(row.expiresAt)}</td>
                                                    {canManage && (
                                                        <td className="p-3 text-center">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="min-h-10 gap-1.5"
                                                                onClick={() => openAssign(row)}
                                                            >
                                                                <Crown className="h-4 w-4" /> تعيين باقة
                                                            </Button>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Approve dialog */}
            <Dialog open={!!approveReq} onOpenChange={(o) => !o && !isProcessing && setApproveReq(null)}>
                <DialogContent className="max-w-md font-arabic">
                    <DialogHeader>
                        <DialogTitle>الموافقة على طلب الباقة</DialogTitle>
                        <DialogDescription>
                            هيتم تفعيل الباقة للمدرس فوراً بعد التأكيد.
                        </DialogDescription>
                    </DialogHeader>
                    {approveReq && (
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between gap-4 border-b pb-2">
                                <span className="text-muted-foreground">المدرس</span>
                                <span className="font-bold">{approveReq.instructor_name}</span>
                            </div>
                            <div className="flex justify-between gap-4 border-b pb-2">
                                <span className="text-muted-foreground">الباقة</span>
                                <span className="font-bold">{planName(approveReq.requested_plan_id)} · {monthsLabel(approveReq.months)}</span>
                            </div>
                            <div className="flex justify-between gap-4 border-b pb-2">
                                <span className="text-muted-foreground">المبلغ</span>
                                <span className="font-bold text-primary">{money(approveReq.amount)}</span>
                            </div>
                            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border p-3">
                                <Checkbox
                                    checked={approveCharge}
                                    onCheckedChange={(v) => setApproveCharge(v === true)}
                                />
                                <span>
                                    <span className="font-bold">خصم من محفظة المدرس</span>
                                    <span className="block text-xs text-muted-foreground">
                                        اتركه فارغاً لو المدرس دفع بطريقة تانية (تحويل/كاش).
                                    </span>
                                </span>
                            </label>
                        </div>
                    )}
                    <DialogFooter className="gap-2 sm:gap-2">
                        <Button variant="outline" className="min-h-11" disabled={isProcessing} onClick={() => setApproveReq(null)}>
                            إلغاء
                        </Button>
                        <Button className="min-h-11 gap-2 bg-green-600 hover:bg-green-700" disabled={isProcessing} onClick={handleApprove}>
                            {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
                            تأكيد الموافقة
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject dialog */}
            <Dialog open={!!rejectReq} onOpenChange={(o) => !o && !isProcessing && setRejectReq(null)}>
                <DialogContent className="max-w-md font-arabic">
                    <DialogHeader>
                        <DialogTitle>رفض طلب الباقة</DialogTitle>
                        <DialogDescription>
                            طلب {rejectReq?.instructor_name} لباقة {planName(rejectReq?.requested_plan_id)}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="reject-note">سبب الرفض (اختياري)</Label>
                        <Textarea
                            id="reject-note"
                            value={rejectNote}
                            onChange={(e) => setRejectNote(e.target.value)}
                            placeholder="مثال: لم يتم استلام المبلغ"
                            rows={3}
                        />
                    </div>
                    <DialogFooter className="gap-2 sm:gap-2">
                        <Button variant="outline" className="min-h-11" disabled={isProcessing} onClick={() => setRejectReq(null)}>
                            إلغاء
                        </Button>
                        <Button variant="destructive" className="min-h-11 gap-2" disabled={isProcessing} onClick={handleReject}>
                            {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
                            تأكيد الرفض
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Assign dialog */}
            <Dialog open={!!assignFor} onOpenChange={(o) => !o && !isProcessing && setAssignFor(null)}>
                <DialogContent className="max-w-md font-arabic">
                    <DialogHeader>
                        <DialogTitle>تعيين باقة</DialogTitle>
                        <DialogDescription>
                            {assignFor?.full_name} — الباقة الحالية: {planName(assignFor?.planId)}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 text-sm">
                        <div className="space-y-2">
                            <Label>الباقة</Label>
                            <div role="radiogroup" aria-label="الباقة" className="grid grid-cols-3 gap-2">
                                {PLAN_LIST.map((p) => {
                                    const active = p.id === assignPlan
                                    return (
                                        <button
                                            key={p.id}
                                            type="button"
                                            role="radio"
                                            aria-checked={active}
                                            onClick={() => setAssignPlan(p.id)}
                                            className={cn(
                                                "min-h-14 rounded-xl border p-2 text-center transition-colors",
                                                active ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
                                            )}
                                        >
                                            <span className="block font-bold">{p.name}</span>
                                            <span className="block text-xs text-muted-foreground">
                                                عمولة {formatRate(p.commissionRate)}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                        {!assignIsFree && (
                            <>
                                <div className="space-y-2">
                                    <Label>المدة</Label>
                                    <MonthsSelector value={assignMonths} onChange={setAssignMonths} />
                                </div>
                                <p className="flex justify-between font-bold">
                                    <span>الإجمالي</span>
                                    <span className="text-primary">{money(assignTotal)}</span>
                                </p>
                                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border p-3">
                                    <Checkbox
                                        checked={assignCharge}
                                        onCheckedChange={(v) => setAssignCharge(v === true)}
                                    />
                                    <span className="font-bold">خصم من محفظة المدرس</span>
                                </label>
                            </>
                        )}
                        {assignIsFree && (
                            <p className="rounded-xl bg-muted/50 p-3 text-muted-foreground">
                                الباقة المجانية بدون مدة انتهاء وبدون أي خصم.
                            </p>
                        )}
                    </div>
                    <DialogFooter className="gap-2 sm:gap-2">
                        <Button variant="outline" className="min-h-11" disabled={isProcessing} onClick={() => setAssignFor(null)}>
                            إلغاء
                        </Button>
                        <Button className="min-h-11 gap-2" disabled={isProcessing} onClick={handleAssign}>
                            {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
                            تعيين الباقة
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
