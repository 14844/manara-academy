"use client"

import { useState, useEffect } from "react"
import { db } from "@/lib/firebase/config"
import { collection, query, where, getDocs, orderBy, doc, getDoc } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    DollarSign,
    Users,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Search,
    Download,
    Printer,
    ArrowUpRight,
    TrendingDown,
    Loader2,
    Wallet
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

export default function AdminSettlementsPage() {
    const [isLoading, setIsLoading] = useState(true)
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
    const [settlements, setSettlements] = useState<any[]>([])
    const [totals, setTotals] = useState({
        gross: 0,
        commission: 0,
        net: 0,
        enrollments: 0
    })

    const months = [
        { value: 1, label: "يناير" },
        { value: 2, label: "فبراير" },
        { value: 3, label: "مارس" },
        { value: 4, label: "أبريل" },
        { value: 5, label: "مايو" },
        { value: 6, label: "يونيو" },
        { value: 7, label: "يوليو" },
        { value: 8, label: "أغسطس" },
        { value: 9, label: "سبتمبر" },
        { value: 10, label: "أكتوبر" },
        { value: 11, label: "نوفمبر" },
        { value: 12, label: "ديسمبر" },
    ]

    const years = [2024, 2025, 2026]

    useEffect(() => {
        fetchSettlements()
    }, [selectedMonth, selectedYear])

    async function fetchSettlements() {
        setIsLoading(true)
        try {
            // Calculate date range for the month
            const startDate = new Date(selectedYear, selectedMonth - 1, 1).toISOString()
            const endDate = new Date(selectedYear, selectedMonth, 1).toISOString()

            // Fetch all enrollments in range
            const enrollmentsQ = query(
                collection(db, "enrollments"),
                where("enrolled_at", ">=", startDate),
                where("enrolled_at", "<", endDate)
            )
            const snap = await getDocs(enrollmentsQ)
            const enrollments = snap.docs.map(doc => doc.data())

            // Group by instructor
            const instructorGroups: Record<string, any> = {}
            const instructorIds = new Set(enrollments.map((e: any) => e.instructor_id))

            // Fetch instructor profiles to get names
            const instructorProfiles: Record<string, string> = {}
            for (const instId of Array.from(instructorIds) as string[]) {
                if (!instId) continue
                const profSnap = await getDoc(doc(db, "profiles", instId))
                if (profSnap.exists()) {
                    instructorProfiles[instId] = profSnap.data().full_name || "محاضر غير معروف"
                }
            }

            enrollments.forEach((enr: any) => {
                const instId = enr.instructor_id
                if (!instructorGroups[instId]) {
                    instructorGroups[instId] = {
                        instructorId: instId,
                        instructorName: instructorProfiles[instId] || "محاضر غير معروف",
                        enrollmentCount: 0,
                        grossRevenue: 0,
                        commission: 0,
                        netPayout: 0,
                        details: []
                    }
                }

                instructorGroups[instId].enrollmentCount += 1
                const amount = Number(enr.paid_amount) || 0
                instructorGroups[instId].grossRevenue += amount
                instructorGroups[instId].details.push({
                    studentName: enr.student_name,
                    courseTitle: enr.course_title,
                    date: enr.enrolled_at,
                    amount: amount
                })
            })

            // Calculate commissions and net
            Object.values(instructorGroups).forEach((group: any) => {
                group.commission = group.grossRevenue * 0.15
                group.netPayout = group.grossRevenue - group.commission
            })

            const sortedSettlements = Object.values(instructorGroups).sort((a, b) => b.grossRevenue - a.grossRevenue)
            setSettlements(sortedSettlements)

            // Calculate grand totals
            const totalGross = sortedSettlements.reduce((acc, s) => acc + s.grossRevenue, 0)
            const totalComm = totalGross * 0.15
            const totalNet = totalGross - totalComm

            setTotals({
                gross: totalGross,
                commission: totalComm,
                net: totalNet,
                enrollments: enrollments.length
            })

        } catch (error) {
            console.error("Settlement fetch error:", error)
            toast.error("حدث خطأ أثناء جلب بيانات التسوية")
        } finally {
            setIsLoading(false)
        }
    }

    const handlePrint = () => {
        window.print()
    }

    return (
        <div className="space-y-8 font-arabic">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
                <div>
                    <h1 className="text-3xl font-black flex items-center gap-3">
                        <DollarSign className="h-8 w-8 text-primary" />
                        تسويات المحاضرين الشهرية
                    </h1>
                    <p className="text-muted-foreground mt-2">حساب الأرباح والعمولات والتحويلات المالية لكل مدرس.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="gap-2" onClick={handlePrint}>
                        <Printer className="h-4 w-4" />
                        طباعة التقرير
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card className="print:hidden border-2 shadow-sm">
                <CardContent className="flex flex-wrap items-center gap-6 py-6">
                    <div className="space-y-1.5 flex-1 min-w-[200px]">
                        <label className="text-xs font-bold text-muted-foreground">السنة</label>
                        <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                            <SelectTrigger className="font-bold">
                                <SelectValue placeholder="اختر السنة" />
                            </SelectTrigger>
                            <SelectContent>
                                {years.map(y => (
                                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-[200px]">
                        <label className="text-xs font-bold text-muted-foreground">الشهر</label>
                        <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                            <SelectTrigger className="font-bold">
                                <SelectValue placeholder="اختر الشهر" />
                            </SelectTrigger>
                            <SelectContent>
                                {months.map(m => (
                                    <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <Button className="mt-6 gap-2 px-8 h-10 font-bold" onClick={fetchSettlements}>
                        <Search className="h-4 w-4" />
                        تحديث البيانات
                    </Button>
                </CardContent>
            </Card>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-2 shadow-sm border-primary/10">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-bold text-muted-foreground mb-1 uppercase">إجمالي الاشتراكات</p>
                                <h3 className="text-2xl font-black">{totals.enrollments} طالب</h3>
                            </div>
                            <div className="p-3 rounded-xl bg-primary/10 text-primary">
                                <Users className="h-5 w-5" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-2 shadow-sm border-blue-100">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-bold text-muted-foreground mb-1 uppercase">إجمالي مبيعات الشهر</p>
                                <h3 className="text-2xl font-black text-blue-600">{totals.gross.toLocaleString()} ج.م</h3>
                            </div>
                            <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
                                <ArrowUpRight className="h-5 w-5" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-2 shadow-sm border-red-100">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-bold text-muted-foreground mb-1 uppercase">عمولة المنصة (15%)</p>
                                <h3 className="text-2xl font-black text-red-600">{totals.commission.toLocaleString()} ج.م</h3>
                            </div>
                            <div className="p-3 rounded-xl bg-red-50 text-red-600">
                                <TrendingDown className="h-5 w-5" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-2 shadow-sm border-green-100 bg-green-50/30">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-bold text-muted-foreground mb-1 uppercase">صافي تحويلات المدرسين</p>
                                <h3 className="text-2xl font-black text-green-600">{totals.net.toLocaleString()} ج.م</h3>
                            </div>
                            <div className="p-3 rounded-xl bg-green-100 text-green-600">
                                <Wallet className="h-5 w-5" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Settlements Table */}
            <Card className="border-2 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/30">
                    <CardTitle className="text-xl font-bold">تقرير المحاضرين - {months.find(m => m.value === selectedMonth)?.label} {selectedYear}</CardTitle>
                    <CardDescription>تفصيل مستحقات كل مدرس بناءً على اشتراكات الطلاب.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="py-20 flex flex-col items-center gap-4 text-muted-foreground">
                            <Loader2 className="h-8 w-8 animate-spin" />
                            <p className="font-bold italic">جاري تجميع البيانات المالية...</p>
                        </div>
                    ) : settlements.length === 0 ? (
                        <div className="py-20 text-center text-muted-foreground italic">
                            لا توجد عمليات لشهر {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead className="text-right">المحاضر</TableHead>
                                        <TableHead className="text-center">عدد الطلاب</TableHead>
                                        <TableHead className="text-center">إجمالي المبيعات</TableHead>
                                        <TableHead className="text-center">عمولة المنصة (15%)</TableHead>
                                        <TableHead className="text-center">المبلغ المستحق للتحويل</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {settlements.map((s, idx) => (
                                        <TableRow key={s.instructorId} className="hover:bg-muted/30 transition-colors">
                                            <TableCell className="font-black text-lg py-4">{s.instructorName}</TableCell>
                                            <TableCell className="text-center font-bold">{s.enrollmentCount} طالب</TableCell>
                                            <TableCell className="text-center font-black text-blue-600">{s.grossRevenue.toLocaleString()} ج.م</TableCell>
                                            <TableCell className="text-center font-bold text-red-500">-{s.commission.toLocaleString()} ج.م</TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 px-4 py-1.5 text-lg font-black rounded-lg border-2 border-green-200">
                                                    {s.netPayout.toLocaleString()} ج.م
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="bg-orange-50 border border-orange-200 p-6 rounded-2xl flex items-start gap-4 print:hidden">
                <div className="h-10 w-10 shrink-0 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                    <Calendar className="h-5 w-5" />
                </div>
                <div>
                    <h4 className="font-bold text-orange-900 mb-1 leading-relaxed">تعليمات التحويل الشهري</h4>
                    <p className="text-sm text-orange-800/80 leading-relaxed font-medium">
                        هذا التقرير مخصص للمساعدة في عملية تسوية الحسابات. يرجى التحقق من قائمة الطلاب لكل مدرس قبل إجراء التحويل البنكي أو عبر فودافون كاش. في حالة وجود شكوى من مدرس، يمكنك مراجعة لوحة "مراجعة المدفوعات" للتأكد من المبالغ المشحونة بالمحفظة.
                    </p>
                </div>
            </div>
        </div>
    )
}
