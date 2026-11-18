"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, Download, Info, RefreshCw, Ticket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { UpgradeNudge } from "@/components/plans/upgrade-nudge"
import {
    formatEGP,
    last30DaysRange,
    planName,
    toYMD,
    type EarningsResponse,
    type EarningsSale,
} from "@/components/plans/plan-types"
import { formatRate } from "@/lib/plans"
import { cn } from "@/lib/utils"

type PeriodKind = "month" | "last30" | "custom"

const PLATFORM_COUPON_NOTE = "خصم من المنصة — مش بيتخصم من أرباحك"

function monthRange(now: Date = new Date()) {
    return { from: toYMD(new Date(now.getFullYear(), now.getMonth(), 1)), to: toYMD(now) }
}

function daysBetween(from: string, to: string): number {
    const a = new Date(`${from}T00:00:00`).getTime()
    const b = new Date(`${to}T00:00:00`).getTime()
    if (!Number.isFinite(a) || !Number.isFinite(b)) return 30
    return Math.max(1, Math.round((b - a) / 86400000) + 1)
}

function formatDay(iso: string): string {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" })
}

function formatMonth(ym: string): string {
    const d = new Date(`${ym}-01T00:00:00`)
    if (Number.isNaN(d.getTime())) return ym
    return d.toLocaleDateString("ar-EG", { month: "long", year: "numeric" })
}

function couponSourceLabel(s: EarningsSale["coupon_source"]): string {
    if (s === "platform") return "من المنصة"
    if (s === "instructor") return "من المدرس"
    return ""
}

/** CSV cell: quoted, quotes doubled, and formula-injection safe (leading = + - @ tab CR get a ' prefix). */
function csvCell(v: unknown): string {
    if (typeof v === "number") return Number.isFinite(v) ? String(v) : ""
    let s = v == null ? "" : String(v)
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
    return `"${s.replace(/"/g, '""')}"`
}

function exportCsv(sales: EarningsSale[], from: string, to: string) {
    const header = [
        "التاريخ", "الكورس", "الطالب", "السعر الأصلي", "الكوبون", "مصدر الكوبون", "الخصم",
        "المدفوع", "الباقة", "العمولة %", "عمولة المنصة", "نصيبك",
    ]
    const rows = sales.map((s) => [
        toYMD(new Date(s.date)),
        s.course_title,
        s.student_label,
        s.list_price,
        s.coupon_code || "",
        couponSourceLabel(s.coupon_source),
        s.discount,
        s.paid,
        planName(s.plan_id),
        Math.round((Number(s.rate) || 0) * 100),
        s.commission,
        s.instructor_share,
    ])
    const csv = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `earnings_${from}_${to}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function InstructorEarningsPage() {
    const [kind, setKind] = useState<PeriodKind>("last30")
    const [custom, setCustom] = useState(() => last30DaysRange())
    const [data, setData] = useState<EarningsResponse | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const range = useMemo(() => {
        if (kind === "month") return monthRange()
        if (kind === "last30") return last30DaysRange()
        return custom
    }, [kind, custom])
    const customInvalid = kind === "custom" && (!range.from || !range.to || range.from > range.to)

    const load = useCallback(async () => {
        if (customInvalid) return
        setIsLoading(true)
        setError(null)
        try {
            const qs = new URLSearchParams({ from: range.from, to: range.to })
            const res = await fetch(`/api/instructor/earnings?${qs}`, { cache: "no-store" })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(json.error || "تعذر تحميل الأرباح")
            setData(json as EarningsResponse)
        } catch (err: any) {
            setError(err?.message || "تعذر تحميل الأرباح")
        } finally {
            setIsLoading(false)
        }
    }, [range.from, range.to, customInvalid])

    useEffect(() => {
        load()
    }, [load])

    const periodLabel = kind === "month" ? "الشهر ده" : kind === "last30" ? "آخر 30 يوم" : "الفترة دي"
    const s = data?.summary
    const hasPlatformCoupon = !!data?.sales.some((x) => x.coupon_source === "platform")

    return (
        <div className="space-y-6 font-arabic">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold">أرباحي</h1>
                    <p className="text-muted-foreground">كل بيع بالتفصيل: الطالب دفع كام، المنصة أخدت كام، ووصلك كام.</p>
                </div>
                <Button
                    variant="outline"
                    className="min-h-11 gap-2 rounded-xl"
                    disabled={!data || data.sales.length === 0}
                    onClick={() => data && exportCsv(data.sales, range.from, range.to)}
                >
                    <Download className="h-4 w-4" /> تصدير CSV
                </Button>
            </div>

            {/* Period picker */}
            <div className="space-y-3">
                <div role="radiogroup" aria-label="الفترة" className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1 sm:inline-grid sm:w-auto">
                    {([
                        ["month", "الشهر ده"],
                        ["last30", "آخر 30 يوم"],
                        ["custom", "فترة مخصصة"],
                    ] as const).map(([k, label]) => (
                        <button
                            key={k}
                            type="button"
                            role="radio"
                            aria-checked={kind === k}
                            onClick={() => setKind(k)}
                            className={cn(
                                "min-h-11 rounded-lg px-3 text-sm font-bold transition-colors",
                                kind === k ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                {kind === "custom" && (
                    <div className="grid grid-cols-2 gap-3 sm:max-w-md">
                        <div className="space-y-1">
                            <Label htmlFor="from">من</Label>
                            <Input
                                id="from"
                                type="date"
                                className="min-h-11"
                                value={custom.from}
                                max={custom.to || undefined}
                                onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="to">إلى</Label>
                            <Input
                                id="to"
                                type="date"
                                className="min-h-11"
                                value={custom.to}
                                min={custom.from || undefined}
                                max={toYMD(new Date())}
                                onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                            />
                        </div>
                        {customInvalid && (
                            <p className="col-span-2 text-sm text-destructive">اختار تاريخ بداية قبل تاريخ النهاية.</p>
                        )}
                    </div>
                )}
            </div>

            {error && !isLoading && (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
                        <AlertTriangle className="h-8 w-8 text-destructive" />
                        <p className="font-bold">{error}</p>
                        <Button variant="outline" className="min-h-11 gap-2" onClick={load}>
                            <RefreshCw className="h-4 w-4" /> إعادة المحاولة
                        </Button>
                    </CardContent>
                </Card>
            )}

            {isLoading && !data && (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                    {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
                </div>
            )}

            {data && s && (
                <div className={cn("space-y-6 transition-opacity", isLoading && "opacity-60")}>
                    <UpgradeNudge
                        whatIf={data.whatIf}
                        periodLabel={periodLabel}
                        periodDays={daysBetween(range.from, range.to)}
                        hasActivity={s.sales > 0}
                    />

                    {/* Summary */}
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                        <SummaryCard label="دفعه الطلاب" value={formatEGP(s.paidTotal)} hint={`${s.sales.toLocaleString("ar-EG")} عملية بيع`} />
                        <SummaryCard label="الخصومات" value={formatEGP(s.discountTotal)} hint={`من أسعار أصلية ${formatEGP(s.listTotal)}`} />
                        <SummaryCard label="عمولة المنصة" value={formatEGP(s.commission)} hint="بتتخصم وقت البيع" />
                        <SummaryCard label="نصيبك" value={formatEGP(s.instructorShare)} hint="اتحط في محفظتك" strong />
                        <SummaryCard label="رصيد المحفظة" value={formatEGP(data.wallet.balance)} hint="متاح للسحب دلوقتي" />
                        <SummaryCard label="سحوبات قيد المراجعة" value={formatEGP(data.wallet.pendingWithdrawals)} hint="اتخصمت من المحفظة" />
                    </div>

                    <div className="flex items-start gap-3 rounded-2xl border bg-muted/40 p-4 text-sm text-muted-foreground">
                        <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                        <div className="space-y-1">
                            <p>
                                العمولة بتتحسب على كل بيع بنسبة الباقة اللي كنت عليها وقتها، ونصيبك بيتحط في محفظتك فوراً.
                                السحب بعد كده بيكون من رصيد المحفظة مباشرة من غير أي خصم تاني.
                            </p>
                            <p>
                                <strong className="text-foreground">كوبونات المنصة:</strong> {PLATFORM_COUPON_NOTE} — بنحسب نصيبك على
                                السعر الأصلي كأن مفيش خصم. كوبوناتك إنت بتتحسب العمولة فيها على السعر بعد الخصم.
                            </p>
                        </div>
                    </div>

                    {/* By plan */}
                    {s.byPlan.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">حسب الباقة</CardTitle>
                                <CardDescription>كل مبيعة اتحسبت بعمولة الباقة اللي كانت شغالة وقت البيع.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-3 sm:grid-cols-3">
                                {s.byPlan.map((p) => (
                                    <div key={`${p.planId}-${p.rate}`} className="rounded-xl border p-4 text-sm">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <span className="font-bold">{planName(String(p.planId))}</span>
                                            <span className="text-xs text-muted-foreground">عمولة {formatRate(p.rate)}</span>
                                        </div>
                                        <dl className="mt-3 space-y-1.5">
                                            <Row k="عدد المبيعات" v={p.sales.toLocaleString("ar-EG")} />
                                            <Row k="دفعه الطلاب" v={formatEGP(p.paidTotal)} />
                                            <Row k="عمولة المنصة" v={formatEGP(p.commission)} />
                                            <Row k="نصيبك" v={formatEGP(p.instructorShare)} strong />
                                        </dl>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {/* By month */}
                    {s.byMonth.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">شهرياً</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50 text-muted-foreground">
                                        <tr>
                                            <th className="p-3 text-right font-medium">الشهر</th>
                                            <th className="p-3 text-right font-medium">المبيعات</th>
                                            <th className="p-3 text-right font-medium">العمولة</th>
                                            <th className="p-3 text-right font-medium">نصيبك</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {s.byMonth.map((m) => (
                                            <tr key={m.month}>
                                                <td className="p-3">{formatMonth(m.month)}</td>
                                                <td className="p-3">{m.sales.toLocaleString("ar-EG")}</td>
                                                <td className="p-3">{formatEGP(m.commission)}</td>
                                                <td className="p-3 font-bold">{formatEGP(m.instructorShare)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </CardContent>
                        </Card>
                    )}

                    {/* Sales */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">المبيعات</CardTitle>
                            <CardDescription>
                                {formatDay(`${range.from}T00:00:00`)} — {formatDay(`${range.to}T00:00:00`)}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0 sm:p-0">
                            {data.sales.length === 0 ? (
                                <p className="p-10 text-center text-sm text-muted-foreground">مفيش مبيعات في الفترة دي.</p>
                            ) : (
                                <>
                                    {/* Mobile: cards */}
                                    <ul className="divide-y md:hidden">
                                        {data.sales.map((x) => (
                                            <li key={x.id} className="space-y-2 p-4 text-sm">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="truncate font-bold">{x.course_title}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {x.student_label} • {formatDay(x.date)}
                                                        </p>
                                                    </div>
                                                    <span className="shrink-0 font-black text-primary">{formatEGP(x.instructor_share)}</span>
                                                </div>
                                                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                                    <Row k="السعر" v={formatEGP(x.list_price)} />
                                                    <Row k="المدفوع" v={formatEGP(x.paid)} />
                                                    <Row k="الباقة" v={`${planName(x.plan_id)} ${formatRate(x.rate)}`} />
                                                    <Row k="العمولة" v={formatEGP(x.commission)} />
                                                </dl>
                                                {x.coupon_code && <CouponTag sale={x} />}
                                            </li>
                                        ))}
                                    </ul>
                                    {/* Desktop: table */}
                                    <div className="hidden overflow-x-auto md:block">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted/50 text-muted-foreground">
                                                <tr>
                                                    {["التاريخ", "الكورس", "الطالب", "السعر", "الكوبون", "المدفوع", "الباقة", "العمولة", "نصيبك"].map((h) => (
                                                        <th key={h} className="whitespace-nowrap p-3 text-right font-medium">{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {data.sales.map((x) => (
                                                    <tr key={x.id} className="align-top">
                                                        <td className="whitespace-nowrap p-3 text-muted-foreground">{formatDay(x.date)}</td>
                                                        <td className="max-w-[220px] truncate p-3 font-medium" title={x.course_title}>{x.course_title}</td>
                                                        <td className="whitespace-nowrap p-3">{x.student_label}</td>
                                                        <td className="whitespace-nowrap p-3">{formatEGP(x.list_price)}</td>
                                                        <td className="p-3">{x.coupon_code ? <CouponTag sale={x} /> : <span className="text-muted-foreground">—</span>}</td>
                                                        <td className="whitespace-nowrap p-3">{formatEGP(x.paid)}</td>
                                                        <td className="whitespace-nowrap p-3">
                                                            {planName(x.plan_id)} <span className="text-muted-foreground">({formatRate(x.rate)})</span>
                                                        </td>
                                                        <td className="whitespace-nowrap p-3">{formatEGP(x.commission)}</td>
                                                        <td className="whitespace-nowrap p-3 font-bold text-primary">{formatEGP(x.instructor_share)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {hasPlatformCoupon && (
                        <p className="text-center text-xs text-muted-foreground">
                            المبيعات اللي عليها &quot;من المنصة&quot;: {PLATFORM_COUPON_NOTE}.
                        </p>
                    )}

                    <p className="text-center text-sm text-muted-foreground">
                        عايز تسحب أرباحك؟{" "}
                        <Link href="/instructor/withdrawals" className="font-bold text-primary underline-offset-4 hover:underline">
                            روح للمحفظة
                        </Link>
                    </p>
                </div>
            )}
        </div>
    )
}

function SummaryCard({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
    return (
        <div className={cn("rounded-2xl border bg-card p-4", strong && "border-primary/40 bg-primary/5")}>
            <p className="text-xs font-bold text-muted-foreground">{label}</p>
            <p className={cn("mt-1 text-lg font-black sm:text-2xl break-words", strong && "text-primary")}>{value}</p>
            {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
        </div>
    )
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
    return (
        <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className={cn(strong && "font-bold text-primary")}>{v}</dd>
        </div>
    )
}

function CouponTag({ sale }: { sale: EarningsSale }) {
    const isPlatform = sale.coupon_source === "platform"
    return (
        <div className="space-y-0.5 text-xs">
            <span
                className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono",
                    isPlatform ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400" : "bg-muted",
                )}
            >
                <Ticket className="h-3 w-3" aria-hidden />
                {sale.coupon_code}
            </span>
            <span className="ms-1 text-muted-foreground">
                {couponSourceLabel(sale.coupon_source)} (−{formatEGP(sale.discount)})
            </span>
            {isPlatform && <p className="text-green-700 dark:text-green-400">{PLATFORM_COUPON_NOTE}</p>}
        </div>
    )
}
