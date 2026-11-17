"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { escapeHtml } from "@/lib/escape-html"
import { PLANS, formatRate, isPlanId, type PlanId } from "@/lib/plans"
import { useAdminRole } from "@/components/admin/admin-role-context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
    AlertTriangle,
    ArrowUpRight,
    Calendar,
    ChevronDown,
    ChevronLeft,
    DollarSign,
    Printer,
    Search,
    Tag,
    TrendingUp,
    Users,
    Wallet,
} from "lucide-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/* ---------- API shape: GET /api/admin/finance/commissions ---------- */

interface Amounts {
    sales: number
    paid: number
    grossCommission: number
    platformNet: number
    instructorShare: number
}

interface PlanBreakdown extends Amounts {
    planId: PlanId | string
    rate: number
}

interface InstructorRow extends Amounts {
    instructorId: string
    name: string
    currentPlanId: PlanId | string | null
    byPlan: PlanBreakdown[]
}

interface CommissionsResponse {
    totals: Amounts & { platformCouponCost: number }
    byPlan: PlanBreakdown[]
    byInstructor: InstructorRow[]
    subscriptions: { total: number; count: number }
}

/* ---------- helpers ---------- */

const MONTHS = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
]

function ymd(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function num(n: unknown): number {
    const v = Number(n)
    return Number.isFinite(v) ? v : 0
}

function money(n: unknown): string {
    return `${num(n).toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ج.م`
}

function planLabel(planId: unknown): string {
    return isPlanId(planId) ? PLANS[planId].name : String(planId ?? "—")
}

/**
 * Platform-coupon cost for a row. The API gives it only in totals; per row it equals
 * grossCommission - platformNet (platform-funded discounts come out of the commission).
 */
function couponCost(a: Amounts): number {
    return Math.max(0, Math.round((num(a.grossCommission) - num(a.platformNet)) * 100) / 100)
}

type PeriodMode = "month" | "custom"

function AmountCells({ a, strong }: { a: Amounts; strong?: boolean }) {
    const cost = couponCost(a)
    return (
        <>
            <TableCell className="text-center font-bold">{num(a.sales).toLocaleString("ar-EG")}</TableCell>
            <TableCell className={cn("text-center text-blue-600", strong ? "font-black" : "font-semibold")}>{money(a.paid)}</TableCell>
            <TableCell className="text-center text-orange-600 font-semibold">{money(a.grossCommission)}</TableCell>
            <TableCell className="text-center text-red-500 font-semibold">{cost > 0 ? `-${money(cost)}` : money(0)}</TableCell>
            <TableCell className={cn("text-center", num(a.platformNet) < 0 ? "text-red-600" : "text-violet-600", strong ? "font-black" : "font-semibold")}>
                {money(a.platformNet)}
            </TableCell>
            <TableCell className={cn("text-center text-green-600", strong ? "font-black" : "font-semibold")}>{money(a.instructorShare)}</TableCell>
        </>
    )
}

export default function AdminSettlementsPage() {
    const { can } = useAdminRole()
    const canView = can("finance.view")

    const now = new Date()
    const [mode, setMode] = useState<PeriodMode>("month")
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
    const [selectedYear, setSelectedYear] = useState(now.getFullYear())
    const [customFrom, setCustomFrom] = useState(ymd(new Date(now.getFullYear(), now.getMonth(), 1)))
    const [customTo, setCustomTo] = useState(ymd(now))

    const [isLoading, setIsLoading] = useState(true)
    const [data, setData] = useState<CommissionsResponse | null>(null)
    const [expanded, setExpanded] = useState<Record<string, boolean>>({})
    const [search, setSearch] = useState("")

    const years = useMemo(() => {
        const current = new Date().getFullYear()
        const list: number[] = []
        for (let y = 2024; y <= current; y++) list.push(y)
        return list
    }, [])

    const range = useMemo(() => {
        if (mode === "custom") return { from: customFrom, to: customTo }
        const from = new Date(selectedYear, selectedMonth - 1, 1)
        const to = new Date(selectedYear, selectedMonth, 0) // last day of month
        return { from: ymd(from), to: ymd(to) }
    }, [mode, customFrom, customTo, selectedMonth, selectedYear])

    const periodLabel =
        mode === "month" ? `${MONTHS[selectedMonth - 1]} ${selectedYear}` : `من ${range.from} إلى ${range.to}`

    const fetchSettlements = useCallback(async () => {
        if (!canView) {
            setIsLoading(false)
            return
        }
        if (!range.from || !range.to || range.from > range.to) {
            toast.error("الفترة المختارة غير صحيحة")
            return
        }
        setIsLoading(true)
        try {
            const res = await fetch(
                `/api/admin/finance/commissions?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
                { cache: "no-store" },
            )
            const json = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(json.error || "حدث خطأ أثناء جلب بيانات التسوية")
            setData(json as CommissionsResponse)
        } catch (error: any) {
            console.error("Settlement fetch error:", error)
            setData(null)
            toast.error(error?.message || "حدث خطأ أثناء جلب بيانات التسوية")
        } finally {
            setIsLoading(false)
        }
    }, [canView, range.from, range.to])

    useEffect(() => {
        fetchSettlements()
        // refetch automatically when the month preset changes; custom range uses the button
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, selectedMonth, selectedYear, canView])

    const instructors = useMemo(() => {
        const rows = [...(data?.byInstructor ?? [])].sort((a, b) => num(b.paid) - num(a.paid))
        const q = search.trim().toLowerCase()
        return q ? rows.filter((r) => (r.name || "").toLowerCase().includes(q)) : rows
    }, [data, search])

    const totals = data?.totals ?? {
        sales: 0, paid: 0, grossCommission: 0, platformCouponCost: 0, platformNet: 0, instructorShare: 0,
    }

    const handlePrint = () => {
        if (!data) return
        const printWindow = window.open("about:blank", "SettlementReport_" + Date.now(), "left=50000,top=50000,width=0,height=0")
        if (!printWindow) {
            alert("يرجى تفعيل السماح بالنوافذ المنبثقة (Popups) لتصدير تقرير التسويات كـ PDF")
            return
        }

        const printDate = new Date().toLocaleDateString("ar-EG", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        })
        const e = escapeHtml
        const m = (n: unknown) => e(money(n))

        const amountCells = (a: Amounts) => `
            <td>${e(num(a.sales).toLocaleString("ar-EG"))}</td>
            <td style="color:#2563eb;font-weight:800;">${m(a.paid)}</td>
            <td style="color:#ea580c;">${m(a.grossCommission)}</td>
            <td style="color:#b91c1c;">${m(couponCost(a))}</td>
            <td style="color:#7c3aed;font-weight:800;">${m(a.platformNet)}</td>
            <td style="color:#16a34a;font-weight:900;">${m(a.instructorShare)}</td>`

        const rowsHtml = instructors.length === 0
            ? `<tr><td colspan="8" style="text-align:center;padding:25px;color:#64748b;">لا توجد مبيعات مسجلة لهذه الفترة.</td></tr>`
            : instructors.map((s) => {
                const planRows = (s.byPlan ?? []).length > 1
                    ? s.byPlan.map((p) => `
                        <tr class="sub-row">
                            <td>↳ ${e(s.name)}</td>
                            <td>${e(planLabel(p.planId))} (${e(formatRate(num(p.rate)))})</td>
                            ${amountCells(p)}
                        </tr>`).join("")
                    : ""
                const single = (s.byPlan ?? []).length === 1 ? s.byPlan[0] : null
                const planCell = single
                    ? `${e(planLabel(single.planId))} (${e(formatRate(num(single.rate)))})`
                    : (s.byPlan ?? []).length > 1 ? "عدة باقات — الإجمالي" : "—"
                return `
                    <tr${(s.byPlan ?? []).length > 1 ? ' class="group-total"' : ""}>
                        <td>${e(s.name || s.instructorId)}</td>
                        <td>${planCell}</td>
                        ${amountCells(s)}
                    </tr>${planRows}`
            }).join("")

        const byPlanHtml = (data.byPlan ?? []).map((p) => `
            <tr>
                <td>${e(planLabel(p.planId))}</td>
                <td>${e(formatRate(num(p.rate)))}</td>
                ${amountCells(p)}
            </tr>`).join("")

        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
                <head>
                    <meta charset="utf-8">
                    <title>تقرير تسويات المحاضرين - ${e(periodLabel)}</title>
                    <style>
                        @page { size: A4 landscape; margin: 10mm 12mm; }
                        * { box-sizing: border-box; }
                        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; direction: rtl; background: #fff; color: #0f172a; margin: 0; padding: 16px; font-size: 12px; line-height: 1.5; }
                        .report-container { border: 2px solid #e2e8f0; border-radius: 16px; padding: 20px; max-width: 1200px; margin: 0 auto; }
                        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 14px; margin-bottom: 18px; }
                        .header h1 { margin: 0; font-size: 20px; font-weight: 900; }
                        .header p { margin: 4px 0 0; color: #64748b; font-size: 12px; font-weight: 600; }
                        .kpi-row { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 20px; }
                        .kpi-card { border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 12px; padding: 10px; text-align: center; }
                        .kpi-card .val { font-size: 15px; font-weight: 900; }
                        .kpi-card .lbl { font-size: 10px; font-weight: 700; color: #64748b; margin-top: 2px; }
                        h2 { font-size: 14px; margin: 18px 0 6px; }
                        table { width: 100%; border-collapse: collapse; font-size: 11px; }
                        th { background: #f1f5f9; color: #334155; font-weight: 800; text-align: center; padding: 8px; border: 1px solid #cbd5e1; }
                        th:first-child { text-align: right; }
                        td { padding: 8px; border: 1px solid #e2e8f0; text-align: center; }
                        td:first-child { text-align: right; font-weight: 800; }
                        tr.sub-row td { background: #fafafa; font-size: 10.5px; }
                        tr.sub-row td:first-child { font-weight: 600; color: #64748b; padding-right: 20px; }
                        tr.group-total td { background: #f8fafc; }
                        .total-row td { background: #f1f5f9 !important; font-weight: 900 !important; border-top: 2px solid #94a3b8; }
                        .note { margin-top: 10px; font-size: 10.5px; color: #64748b; }
                        .footer { margin-top: 32px; padding-top: 14px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; align-items: flex-end; font-size: 12px; }
                        .stamp-block { text-align: center; min-width: 180px; }
                        .stamp-line { height: 56px; border-bottom: 1px solid #94a3b8; margin-bottom: 6px; }
                    </style>
                </head>
                <body>
                    <div class="report-container">
                        <div class="header">
                            <div>
                                <h1>أكاديمية المنارة التعليمية - الإدارة المالية</h1>
                                <p>كشف تسويات وأرباح المحاضرين حسب الباقة - (${e(periodLabel)})</p>
                            </div>
                            <div style="text-align:left;font-size:11px;color:#64748b;">
                                <div><strong>تاريخ الاستخراج:</strong> ${e(printDate)}</div>
                                <div><strong>الفترة:</strong> ${e(range.from)} ← ${e(range.to)}</div>
                            </div>
                        </div>

                        <div class="kpi-row">
                            <div class="kpi-card"><div class="val">${e(num(totals.sales).toLocaleString("ar-EG"))}</div><div class="lbl">عدد المبيعات</div></div>
                            <div class="kpi-card"><div class="val" style="color:#2563eb;">${m(totals.paid)}</div><div class="lbl">المدفوع من الطلاب</div></div>
                            <div class="kpi-card"><div class="val" style="color:#ea580c;">${m(totals.grossCommission)}</div><div class="lbl">إجمالي العمولة</div></div>
                            <div class="kpi-card"><div class="val" style="color:#b91c1c;">${m(totals.platformCouponCost)}</div><div class="lbl">تكلفة كوبونات المنصة</div></div>
                            <div class="kpi-card"><div class="val" style="color:#7c3aed;">${m(totals.platformNet)}</div><div class="lbl">صافي المنصة</div></div>
                            <div class="kpi-card"><div class="val" style="color:#16a34a;">${m(totals.instructorShare)}</div><div class="lbl">مستحقات المدرسين</div></div>
                        </div>

                        <h2>حسب الباقة</h2>
                        <table>
                            <thead><tr>
                                <th>الباقة</th><th>العمولة</th><th>المبيعات</th><th>المدفوع</th><th>إجمالي العمولة</th>
                                <th>تكلفة كوبونات المنصة</th><th>صافي المنصة</th><th>نصيب المدرس</th>
                            </tr></thead>
                            <tbody>${byPlanHtml || `<tr><td colspan="8" style="text-align:center;color:#64748b;">—</td></tr>`}</tbody>
                        </table>

                        <h2>حسب المحاضر</h2>
                        <table>
                            <thead><tr>
                                <th>اسم المحاضر</th><th>الباقة / النسبة</th><th>المبيعات</th><th>المدفوع</th><th>إجمالي العمولة</th>
                                <th>تكلفة كوبونات المنصة</th><th>صافي المنصة</th><th>نصيب المدرس</th>
                            </tr></thead>
                            <tbody>
                                ${rowsHtml}
                                ${instructors.length > 0 ? `
                                    <tr class="total-row">
                                        <td>الإجمالي العام للفترة</td>
                                        <td>—</td>
                                        <td>${e(num(totals.sales).toLocaleString("ar-EG"))}</td>
                                        <td>${m(totals.paid)}</td>
                                        <td>${m(totals.grossCommission)}</td>
                                        <td>${m(totals.platformCouponCost)}</td>
                                        <td>${m(totals.platformNet)}</td>
                                        <td>${m(totals.instructorShare)}</td>
                                    </tr>` : ""}
                            </tbody>
                        </table>
                        <p class="note">كل عملية بيع محسوبة بنسبة الباقة اللي كان عليها المدرس وقت البيع. كوبونات المنصة على حساب المنصة والمدرس بياخد نصيبه كامل؛ كوبونات المدرس بتقلل المبلغ اللي بتتحسب منه العمولة.</p>
                        <p class="note">إيرادات اشتراكات الباقات في نفس الفترة (منفصلة عن العمولات): ${m(data.subscriptions?.total)} — ${e(num(data.subscriptions?.count).toLocaleString("ar-EG"))} اشتراك.</p>

                        <div class="footer">
                            <div>
                                <p style="margin:0;font-weight:700;">أكاديمية المنارة للتعليم الإلكتروني © ${e(new Date().getFullYear())}</p>
                                <p style="margin:2px 0 0;color:#64748b;font-size:11px;">مستند مالي إداري مخصص لأغراض التدقيق والمراجعة والتحويلات البنكية.</p>
                            </div>
                            <div class="stamp-block"><div class="stamp-line"></div><div>توقيع المدير المالي</div></div>
                            <div class="stamp-block"><div class="stamp-line"></div><div>اعتماد الإدارة العليا / الختم</div></div>
                        </div>
                    </div>
                </body>
            </html>
        `)
        printWindow.document.close()
        printWindow.focus()
        setTimeout(() => {
            printWindow.print()
            printWindow.close()
        }, 300)
    }

    if (!canView) {
        return (
            <div className="flex items-start gap-3 rounded-xl border border-orange-500/30 bg-orange-500/10 p-4 text-sm text-orange-700 dark:text-orange-300 font-arabic">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>دورك الحالي لا يملك صلاحية عرض البيانات المالية.</p>
            </div>
        )
    }

    const stats: { label: string; value: string; icon: typeof Users; tone: string }[] = [
        { label: "عدد المبيعات", value: num(totals.sales).toLocaleString("ar-EG"), icon: Users, tone: "text-primary bg-primary/10" },
        { label: "المدفوع من الطلاب", value: money(totals.paid), icon: ArrowUpRight, tone: "text-blue-600 bg-blue-500/10" },
        { label: "إجمالي العمولة", value: money(totals.grossCommission), icon: DollarSign, tone: "text-orange-600 bg-orange-500/10" },
        { label: "تكلفة كوبونات المنصة", value: money(totals.platformCouponCost), icon: Tag, tone: "text-red-600 bg-red-500/10" },
        { label: "صافي المنصة", value: money(totals.platformNet), icon: TrendingUp, tone: "text-violet-600 bg-violet-500/10" },
        { label: "مستحقات المدرسين", value: money(totals.instructorShare), icon: Wallet, tone: "text-green-600 bg-green-500/10" },
    ]

    return (
        <div className="space-y-8 font-arabic">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
                <div>
                    <h1 className="text-3xl font-black flex items-center gap-3">
                        <DollarSign className="h-8 w-8 text-primary" />
                        تسويات المحاضرين
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        العمولة بتتحسب على كل عملية بيع بنسبة باقة المدرس وقت البيع — المدرس اللي غيّر باقته بتظهر مبيعاته لكل باقة لوحدها.
                    </p>
                </div>
                <Button variant="outline" className="gap-2 min-h-11" onClick={handlePrint} disabled={!data || isLoading}>
                    <Printer className="h-4 w-4" />
                    طباعة التقرير
                </Button>
            </div>

            {/* Period filter */}
            <Card className="print:hidden border-2 shadow-sm">
                <CardContent className="flex flex-wrap items-end gap-4 py-6">
                    <div className="space-y-1.5 min-w-[160px]">
                        <label className="text-xs font-bold text-muted-foreground">نوع الفترة</label>
                        <Select value={mode} onValueChange={(v) => setMode(v as PeriodMode)}>
                            <SelectTrigger className="font-bold min-h-11">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="month">شهر محدد</SelectItem>
                                <SelectItem value="custom">فترة مخصصة</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {mode === "month" ? (
                        <>
                            <div className="space-y-1.5 flex-1 min-w-[140px]">
                                <label className="text-xs font-bold text-muted-foreground">السنة</label>
                                <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                                    <SelectTrigger className="font-bold min-h-11">
                                        <SelectValue placeholder="اختر السنة" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {years.map((y) => (
                                            <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5 flex-1 min-w-[140px]">
                                <label className="text-xs font-bold text-muted-foreground">الشهر</label>
                                <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                                    <SelectTrigger className="font-bold min-h-11">
                                        <SelectValue placeholder="اختر الشهر" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {MONTHS.map((label, i) => (
                                            <SelectItem key={label} value={(i + 1).toString()}>{label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="space-y-1.5 flex-1 min-w-[150px]">
                                <label htmlFor="settle-from" className="text-xs font-bold text-muted-foreground">من</label>
                                <Input id="settle-from" type="date" className="min-h-11" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} />
                            </div>
                            <div className="space-y-1.5 flex-1 min-w-[150px]">
                                <label htmlFor="settle-to" className="text-xs font-bold text-muted-foreground">إلى</label>
                                <Input id="settle-to" type="date" className="min-h-11" value={customTo} min={customFrom} onChange={(e) => setCustomTo(e.target.value)} />
                            </div>
                        </>
                    )}

                    <Button className="gap-2 px-8 min-h-11 font-bold" onClick={fetchSettlements} disabled={isLoading}>
                        <Search className="h-4 w-4" />
                        تحديث البيانات
                    </Button>
                </CardContent>
            </Card>

            {/* Totals */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                {stats.map((s) => (
                    <Card key={s.label} className="border-2 shadow-sm">
                        <CardContent className="p-4">
                            <div className="flex justify-between items-start gap-2">
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-muted-foreground mb-1">{s.label}</p>
                                    {isLoading ? <Skeleton className="h-7 w-24" /> : <h3 className="text-lg sm:text-xl font-black truncate">{s.value}</h3>}
                                </div>
                                <div className={cn("p-2 rounded-xl shrink-0", s.tone)}>
                                    <s.icon className="h-4 w-4" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* By plan */}
            <Card className="border-2 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/30">
                    <CardTitle className="text-lg font-bold">حسب الباقة — {periodLabel}</CardTitle>
                    <CardDescription>
                        إيرادات اشتراكات الباقات في نفس الفترة (منفصلة عن العمولات): <span className="font-bold text-foreground">{money(data?.subscriptions?.total)}</span>
                        {" "}({num(data?.subscriptions?.count).toLocaleString("ar-EG")} اشتراك)
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="text-right">الباقة</TableHead>
                                    <TableHead className="text-center">المبيعات</TableHead>
                                    <TableHead className="text-center">المدفوع من الطلاب</TableHead>
                                    <TableHead className="text-center">إجمالي العمولة</TableHead>
                                    <TableHead className="text-center">تكلفة كوبونات المنصة</TableHead>
                                    <TableHead className="text-center">صافي المنصة</TableHead>
                                    <TableHead className="text-center">نصيب المدرس</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={7}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                                ) : (data?.byPlan ?? []).length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">لا توجد مبيعات في هذه الفترة</TableCell>
                                    </TableRow>
                                ) : (
                                    (data?.byPlan ?? []).map((p) => (
                                        <TableRow key={`${p.planId}-${p.rate}`}>
                                            <TableCell className="font-bold">
                                                {planLabel(p.planId)} <Badge variant="secondary" className="ms-1">{formatRate(num(p.rate))}</Badge>
                                            </TableCell>
                                            <AmountCells a={p} />
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* By instructor */}
            <Card className="border-2 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/30 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0">
                    <div>
                        <CardTitle className="text-lg font-bold">تقرير المحاضرين — {periodLabel}</CardTitle>
                        <CardDescription>اضغط على المدرس لعرض تفصيل مبيعاته لكل باقة/نسبة.</CardDescription>
                    </div>
                    <div className="relative sm:w-64">
                        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input placeholder="بحث باسم المدرس..." className="min-h-11 pr-10" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="py-6 px-4 space-y-4">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-4">
                                    <Skeleton className="h-9 w-9 rounded-full" />
                                    <div className="flex-1 space-y-1.5">
                                        <Skeleton className="h-4 w-40" />
                                        <Skeleton className="h-3 w-24" />
                                    </div>
                                    <Skeleton className="h-4 w-20" />
                                    <Skeleton className="h-4 w-16" />
                                    <Skeleton className="h-4 w-20" />
                                </div>
                            ))}
                        </div>
                    ) : instructors.length === 0 ? (
                        <div className="py-20 text-center text-muted-foreground">
                            لا توجد مبيعات لفترة {periodLabel}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table className="min-w-[960px]">
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead className="text-right">المحاضر</TableHead>
                                        <TableHead className="text-center">المبيعات</TableHead>
                                        <TableHead className="text-center">المدفوع من الطلاب</TableHead>
                                        <TableHead className="text-center">إجمالي العمولة</TableHead>
                                        <TableHead className="text-center">تكلفة كوبونات المنصة</TableHead>
                                        <TableHead className="text-center">صافي المنصة</TableHead>
                                        <TableHead className="text-center">نصيب المدرس</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {instructors.map((s) => {
                                        const plans = s.byPlan ?? []
                                        const multi = plans.length > 1
                                        const open = !!expanded[s.instructorId]
                                        return (
                                            <Fragment key={s.instructorId}>
                                                <TableRow
                                                    className={cn("transition-colors", multi && "cursor-pointer hover:bg-muted/30")}
                                                    onClick={multi ? () => setExpanded((x) => ({ ...x, [s.instructorId]: !open })) : undefined}
                                                >
                                                    <TableCell className="py-4">
                                                        <div className="flex items-center gap-2">
                                                            {multi && (open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronLeft className="h-4 w-4 shrink-0" />)}
                                                            <div className="min-w-0">
                                                                <p className="font-black">{s.name || "محاضر غير معروف"}</p>
                                                                <div className="mt-1 flex flex-wrap gap-1">
                                                                    {plans.map((p) => (
                                                                        <Badge key={`${p.planId}-${p.rate}`} variant="outline" className="text-[11px]">
                                                                            {planLabel(p.planId)} {formatRate(num(p.rate))}
                                                                        </Badge>
                                                                    ))}
                                                                    {multi && <Badge className="text-[11px] bg-primary/10 text-primary border-primary/30">الإجمالي لـ {plans.length} باقات</Badge>}
                                                                    {isPlanId(s.currentPlanId) && (
                                                                        <span className="text-[11px] text-muted-foreground">الحالية: {PLANS[s.currentPlanId].name}</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <AmountCells a={s} strong />
                                                </TableRow>
                                                {multi && open && plans.map((p) => (
                                                    <TableRow key={`${s.instructorId}-${p.planId}-${p.rate}`} className="bg-muted/20 text-sm">
                                                        <TableCell className="pr-10 text-muted-foreground">
                                                            ↳ {planLabel(p.planId)} ({formatRate(num(p.rate))})
                                                        </TableCell>
                                                        <AmountCells a={p} />
                                                    </TableRow>
                                                ))}
                                            </Fragment>
                                        )
                                    })}
                                    <TableRow className="bg-muted/50 font-black border-t-2">
                                        <TableCell className="font-black">الإجمالي العام للفترة</TableCell>
                                        <TableCell className="text-center">{num(totals.sales).toLocaleString("ar-EG")}</TableCell>
                                        <TableCell className="text-center text-blue-600">{money(totals.paid)}</TableCell>
                                        <TableCell className="text-center text-orange-600">{money(totals.grossCommission)}</TableCell>
                                        <TableCell className="text-center text-red-500">{money(totals.platformCouponCost)}</TableCell>
                                        <TableCell className="text-center text-violet-600">{money(totals.platformNet)}</TableCell>
                                        <TableCell className="text-center text-green-600">{money(totals.instructorShare)}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 p-6 rounded-2xl flex items-start gap-4 print:hidden">
                <div className="h-10 w-10 shrink-0 rounded-full bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center text-orange-600">
                    <Calendar className="h-5 w-5" />
                </div>
                <div>
                    <h4 className="font-bold text-orange-900 dark:text-orange-200 mb-1 leading-relaxed">إزاي بتتحسب الأرقام</h4>
                    <p className="text-sm text-orange-800/80 dark:text-orange-200/80 leading-relaxed font-medium">
                        العمولة بتتخصم على كل عملية بيع لحظة البيع بنسبة باقة المدرس وقتها (البداية {formatRate(PLANS.starter.commissionRate)}، المحترف {formatRate(PLANS.pro.commissionRate)}، النخبة {formatRate(PLANS.center.commissionRate)})، والسحب من المحفظة بدون أي عمولة إضافية.
                        كوبونات المنصة على حساب المنصة والمدرس بياخد نصيبه كامل — عشان كده صافي المنصة ممكن يكون بالسالب. كوبونات المدرس بتقلل المبلغ اللي بتتحسب منه العمولة.
                    </p>
                </div>
            </div>
        </div>
    )
}
