"use client"

import { useState, useEffect, useMemo } from "react"
import { auth, db } from "@/lib/firebase/config"
import { collection, query, getDocs, orderBy, limit } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
    Activity,
    Search,
    RefreshCw,
    Download,
    DollarSign,
    UserCheck,
    AlertTriangle,
    ShieldAlert,
    CheckCircle2,
    XCircle,
    Clock,
    User,
    BookOpen,
    CreditCard,
    ArrowDownRight,
    ArrowUpRight,
    Eye,
    Filter,
    Layers,
    FileSpreadsheet,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Bot,
    Trash2
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"

export interface ActivityLog {
    id: string;
    action: string;
    category: "financial" | "auth" | "admin_action" | "course" | "system" | "ai_support";
    title: string;
    description: string;
    status: "success" | "failed" | "pending" | "info";
    user_id?: string;
    user_name?: string;
    user_email?: string;
    user_role?: "student" | "instructor" | "admin" | "system";
    target_user_id?: string;
    target_user_name?: string;
    amount?: number | null;
    metadata?: Record<string, any>;
    error_message?: string;
    created_at: string;
    timestamp?: number;
}

export default function AdminLogsPage() {
    const [logs, setLogs] = useState<ActivityLog[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedRole, setSelectedRole] = useState("all")
    const [selectedCategory, setSelectedCategory] = useState("all")
    const [selectedStatus, setSelectedStatus] = useState("all")
    const [selectedTimeRange, setSelectedTimeRange] = useState("all")
    const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null)
    const [currentPage, setCurrentPage] = useState(1)
    const [isClearing, setIsClearing] = useState(false)
    const itemsPerPage = 20

    useEffect(() => {
        fetchLogs()
    }, [])

    async function fetchLogs() {
        setIsRefreshing(true)
        try {
            const logsRef = collection(db, "activity_logs")
            // Fetch latest 500 logs ordered by created_at desc
            let q = query(logsRef, orderBy("created_at", "desc"), limit(500))
            
            let snap;
            try {
                snap = await getDocs(q)
            } catch (queryErr) {
                // If orderBy index is building or not yet available, fallback to simple fetch and sort in memory
                snap = await getDocs(query(logsRef, limit(500)))
            }

            const rawLogs: ActivityLog[] = snap.docs.map(doc => ({
                id: doc.id,
                ...(doc.data() as any),
            }))

            // Sort safely in-memory desc
            rawLogs.sort((a, b) => {
                const timeA = new Date(a.created_at || 0).getTime()
                const timeB = new Date(b.created_at || 0).getTime()
                return timeB - timeA
            })

            setLogs(rawLogs)
        } catch (error: any) {
            console.error("Error fetching logs:", error)
            toast.error("حدث خطأ أثناء تحميل سجلات النشاط")
        } finally {
            setIsLoading(false)
            setIsRefreshing(false)
        }
    }

    // Filtered logs
    const filteredLogs = useMemo(() => {
        const now = Date.now()
        return logs.filter(log => {
            // Search text
            if (searchTerm.trim()) {
                const s = searchTerm.toLowerCase().trim()
                const matchesUser = (log.user_name || "").toLowerCase().includes(s)
                const matchesEmail = (log.user_email || "").toLowerCase().includes(s)
                const matchesTitle = (log.title || "").toLowerCase().includes(s)
                const matchesDesc = (log.description || "").toLowerCase().includes(s)
                const matchesAction = (log.action || "").toLowerCase().includes(s)
                if (!matchesUser && !matchesEmail && !matchesTitle && !matchesDesc && !matchesAction) {
                    return false
                }
            }

            // Role filter
            if (selectedRole !== "all" && log.user_role !== selectedRole) {
                return false
            }

            // Category filter
            if (selectedCategory !== "all" && log.category !== selectedCategory) {
                return false
            }

            // Status filter
            if (selectedStatus !== "all" && log.status !== selectedStatus) {
                return false
            }

            // Time range filter
            if (selectedTimeRange !== "all") {
                const logTime = new Date(log.created_at).getTime()
                if (selectedTimeRange === "today") {
                    const startOfToday = new Date().setHours(0, 0, 0, 0)
                    if (logTime < startOfToday) return false
                } else if (selectedTimeRange === "7days") {
                    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
                    if (logTime < sevenDaysAgo) return false
                } else if (selectedTimeRange === "30days") {
                    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000
                    if (logTime < thirtyDaysAgo) return false
                }
            }

            return true
        })
    }, [logs, searchTerm, selectedRole, selectedCategory, selectedStatus, selectedTimeRange])

    // Statistics
    const stats = useMemo(() => {
        let totalFinancialAmount = 0
        let financialCount = 0
        let authCount = 0
        let failedCount = 0

        logs.forEach(log => {
            if (log.category === "financial") {
                financialCount++
                if (log.amount && log.status === "success") {
                    totalFinancialAmount += Number(log.amount)
                }
            } else if (log.category === "auth") {
                authCount++
            }
            if (log.status === "failed") {
                failedCount++
            }
        })

        return {
            total: logs.length,
            financialCount,
            totalFinancialAmount,
            authCount,
            failedCount,
        }
    }, [logs])

    // Pagination
    const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1
    const paginatedLogs = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage
        return filteredLogs.slice(start, start + itemsPerPage)
    }, [filteredLogs, currentPage])

    // Export to CSV
    function handleExportCSV() {
        if (!filteredLogs.length) {
            toast.error("لا توجد سجلات لتصديرها")
            return
        }

        const headers = ["المعرف", "الوقت والتاريخ", "المستخدم", "البريد الإلكتروني", "الدور", "الفئة", "نوع العملية", "الوصف", "المبلغ (ج.م)", "الحالة"]
        const rows = filteredLogs.map(l => [
            l.id,
            new Date(l.created_at).toLocaleString("ar-EG"),
            l.user_name || "غير محدد",
            l.user_email || "",
            getRoleLabel(l.user_role),
            getCategoryLabel(l.category),
            l.title,
            `"${(l.description || "").replace(/"/g, '""')}"`,
            l.amount ? l.amount.toString() : "0",
            getStatusLabel(l.status),
        ])

        // Add UTF-8 BOM so Excel opens Arabic correctly
        const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n")
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `manara_logs_${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
        toast.success("تم تصدير سجلات المنصة بنجاح!")
    }

    // Clear all logs
    async function handleClearLogs() {
        if (!window.confirm("هل أنت متأكد تماماً من رغبتك في تصفير جميع سجلات النشاط للبدء من جديد؟ لا يمكن التراجع عن هذا الإجراء.")) {
            return
        }

        setIsClearing(true)
        try {
            const idToken = await auth.currentUser?.getIdToken()
            const res = await fetch("/api/admin/logs/clear", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idToken }),
            })

            const data = await res.json()
            if (!res.ok) {
                throw new Error(data.error || "فشل تصفير السجلات")
            }

            toast.success(data.message || "تم تصفير السجلات بنجاح")
            await fetchLogs()
        } catch (err: any) {
            console.error("Clear logs error:", err)
            toast.error(err.message || "حدث خطأ أثناء تصفير السجلات")
        } finally {
            setIsClearing(false)
        }
    }

    // Role Label & Colors
    function getRoleBadge(role?: string) {
        switch (role) {
            case "admin":
                return <Badge className="bg-rose-500/10 text-rose-600 border-rose-200">مسؤول المنصة</Badge>
            case "instructor":
                return <Badge className="bg-purple-500/10 text-purple-600 border-purple-200">مدرس / محاضر</Badge>
            case "student":
                return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200">طالب</Badge>
            case "system":
                return <Badge className="bg-zinc-500/10 text-zinc-600 border-zinc-200">النظام التلقائي</Badge>
            default:
                return <Badge variant="outline">مستخدم</Badge>
        }
    }

    function getRoleLabel(role?: string) {
        switch (role) {
            case "admin": return "مسؤول"
            case "instructor": return "محاضر"
            case "student": return "طالب"
            case "system": return "النظام"
            default: return "مستخدم"
        }
    }

    // Category Label & Icons
    function getCategoryBadge(category: string) {
        switch (category) {
            case "financial":
                return (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        <span>مالية</span>
                    </Badge>
                )
            case "auth":
                return (
                    <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 flex items-center gap-1">
                        <UserCheck className="w-3 h-3" />
                        <span>أمان وحسابات</span>
                    </Badge>
                )
            case "admin_action":
                return (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" />
                        <span>إجراء إداري</span>
                    </Badge>
                )
            case "course":
                return (
                    <Badge variant="outline" className="bg-cyan-50 text-cyan-700 border-cyan-200 flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />
                        <span>كورسات</span>
                    </Badge>
                )
            case "ai_support":
                return (
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 flex items-center gap-1">
                        <Bot className="w-3 h-3" />
                        <span>ذكاء اصطناعي AI</span>
                    </Badge>
                )
            default:
                return <Badge variant="outline">نظام</Badge>
        }
    }

    function getCategoryLabel(category: string) {
        switch (category) {
            case "financial": return "معاملات مالية"
            case "auth": return "أمان وحسابات"
            case "admin_action": return "إجراء إداري"
            case "course": return "كورسات"
            case "ai_support": return "ذكاء اصطناعي AI"
            default: return "النظام"
        }
    }

    // Status Badge
    function getStatusBadge(status: string) {
        switch (status) {
            case "success":
                return (
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 flex items-center gap-1 w-fit">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>ناجحة</span>
                    </Badge>
                )
            case "failed":
                return (
                    <Badge className="bg-rose-500/10 text-rose-600 border-rose-200 flex items-center gap-1 w-fit">
                        <XCircle className="w-3 h-3" />
                        <span>فاشلة</span>
                    </Badge>
                )
            case "pending":
                return (
                    <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 flex items-center gap-1 w-fit">
                        <Clock className="w-3 h-3" />
                        <span>معلقة</span>
                    </Badge>
                )
            default:
                return (
                    <Badge variant="outline" className="w-fit">
                        معلومات
                    </Badge>
                )
        }
    }

    function getStatusLabel(status: string) {
        switch (status) {
            case "success": return "ناجحة"
            case "failed": return "فاشلة"
            case "pending": return "معلقة"
            default: return "معلومات"
        }
    }

    // Format Date Arabic
    function formatDate(isoString: string) {
        try {
            const date = new Date(isoString)
            return {
                date: date.toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" }),
                time: date.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }),
            }
        } catch (e) {
            return { date: isoString, time: "" }
        }
    }

    return (
        <div className="space-y-8 font-arabic">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
                <div>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                            <Activity className="h-7 w-7" />
                        </div>
                        <span>سجل العمليات والنشاطات (Audit Logs)</span>
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                        تتبع وتوثيق شامل ولحظي لكافة العمليات المالية، حركات الدخول، اشتراكات الطلاب، وطلبات السحب وقرارات الإدارة.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleClearLogs}
                        disabled={isClearing || isRefreshing}
                        className="gap-2 font-bold text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300"
                        title="تصفير ومسح السجلات لبدء دورة اختبار جديدة"
                    >
                        <Trash2 className="w-4 h-4" />
                        <span>{isClearing ? "جاري التصفير..." : "تصفير السجلات"}</span>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportCSV}
                        className="gap-2 font-bold hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
                    >
                        <Download className="w-4 h-4" />
                        <span>تصدير Excel / CSV</span>
                    </Button>
                    <Button
                        variant="default"
                        size="sm"
                        onClick={fetchLogs}
                        disabled={isRefreshing}
                        className="gap-2 font-bold shadow-sm"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
                        <span>تحديث السجل</span>
                    </Button>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-bold text-muted-foreground">إجمالي الحركات المسجلة</CardTitle>
                        <div className="p-2 bg-primary/10 text-primary rounded-lg">
                            <Layers className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-foreground">{stats.total.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">عملية موثقة في قاعدة البيانات</p>
                    </CardContent>
                </Card>

                <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-bold text-muted-foreground">المعاملات المالية الناجحة</CardTitle>
                        <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg">
                            <DollarSign className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-emerald-600">
                            {stats.totalFinancialAmount.toLocaleString()} <span className="text-xs font-bold text-muted-foreground">ج.م</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{stats.financialCount} حركة مالية (شحن، شراء، سحب)</p>
                    </CardContent>
                </Card>

                <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-bold text-muted-foreground">عمليات الدخول والتسجيل</CardTitle>
                        <div className="p-2 bg-indigo-500/10 text-indigo-600 rounded-lg">
                            <UserCheck className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-indigo-600">{stats.authCount.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">تسجيل جديد وتسجيلات دخول</p>
                    </CardContent>
                </Card>

                <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-bold text-muted-foreground">عمليات فاشلة / تنبيهات</CardTitle>
                        <div className="p-2 bg-rose-500/10 text-rose-600 rounded-lg">
                            <AlertTriangle className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-black ${stats.failedCount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                            {stats.failedCount}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">عمليات تم رفضها أو فشل إتمامها</p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters Section */}
            <Card className="border-border/60 shadow-sm">
                <CardHeader className="pb-3 border-b">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-primary" />
                        <CardTitle className="text-base font-bold">فلترة وبحث السجلات</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        {/* Search Input */}
                        <div className="relative lg:col-span-1 sm:col-span-2">
                            <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="بحث باسم المستخدم، الإيميل، أو البيان..."
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value)
                                    setCurrentPage(1)
                                }}
                                className="pr-9"
                            />
                        </div>

                        {/* Role Filter */}
                        <div>
                            <Select value={selectedRole} onValueChange={(val) => { setSelectedRole(val); setCurrentPage(1); }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="دور المستخدم" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">كل الأدوار</SelectItem>
                                    <SelectItem value="student">طلاب</SelectItem>
                                    <SelectItem value="instructor">مدرسين</SelectItem>
                                    <SelectItem value="admin">مسؤولين</SelectItem>
                                    <SelectItem value="system">النظام</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Category Filter */}
                        <div>
                            <Select value={selectedCategory} onValueChange={(val) => { setSelectedCategory(val); setCurrentPage(1); }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="نوع العملية" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">كل الفئات</SelectItem>
                                    <SelectItem value="financial">معاملات مالية (شحن / سحب / شراء)</SelectItem>
                                    <SelectItem value="auth">حسابات وأمان (دخول / تسجيل)</SelectItem>
                                    <SelectItem value="admin_action">إجراءات إدارية وموافقات</SelectItem>
                                    <SelectItem value="course">كورسات</SelectItem>
                                    <SelectItem value="ai_support">دعم ذكي AI ومحادثات</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Status Filter */}
                        <div>
                            <Select value={selectedStatus} onValueChange={(val) => { setSelectedStatus(val); setCurrentPage(1); }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="الحالة" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">كل الحالات</SelectItem>
                                    <SelectItem value="success">ناجحة فقط</SelectItem>
                                    <SelectItem value="failed">فاشلة فقط</SelectItem>
                                    <SelectItem value="pending">معلقة فقط</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Time Range Filter */}
                        <div>
                            <Select value={selectedTimeRange} onValueChange={(val) => { setSelectedTimeRange(val); setCurrentPage(1); }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="الفترة الزمنية" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">كل الأوقات</SelectItem>
                                    <SelectItem value="today">اليوم</SelectItem>
                                    <SelectItem value="7days">آخر 7 أيام</SelectItem>
                                    <SelectItem value="30days">آخر 30 يوم</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-3 border-t text-xs text-muted-foreground">
                        <div>
                            عدد السجلات المطابقة: <strong className="text-foreground">{filteredLogs.length}</strong> من أصل {logs.length}
                        </div>
                        {(searchTerm || selectedRole !== "all" || selectedCategory !== "all" || selectedStatus !== "all" || selectedTimeRange !== "all") && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setSearchTerm("")
                                    setSelectedRole("all")
                                    setSelectedCategory("all")
                                    setSelectedStatus("all")
                                    setSelectedTimeRange("all")
                                    setCurrentPage(1)
                                }}
                                className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            >
                                إعادة ضبط الفلاتر
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Logs Table */}
            <Card className="border-border/60 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/20 border-b pb-4">
                    <CardTitle className="text-base font-bold flex items-center justify-between">
                        <span>سجل الأحداث التفصيلي</span>
                        <span className="text-xs font-normal text-muted-foreground">
                            صفحة {currentPage} من {totalPages}
                        </span>
                    </CardTitle>
                </CardHeader>
                <div className="overflow-x-auto overflow-y-auto max-h-[650px] relative border-t border-border/60">
                    <Table className="min-w-[1150px] table-fixed">
                        <TableHeader className="bg-muted/95 backdrop-blur-md sticky top-0 z-20 shadow-xs border-b">
                            <TableRow>
                                <TableHead className="w-[160px] text-right font-bold">الوقت والتاريخ</TableHead>
                                <TableHead className="w-[230px] text-right font-bold">المستخدم / الفاعل</TableHead>
                                <TableHead className="w-[210px] text-right font-bold">العملية والنوع</TableHead>
                                <TableHead className="w-[350px] text-right font-bold">البيان والتفاصيل</TableHead>
                                <TableHead className="w-[120px] text-right font-bold">المبلغ المالي</TableHead>
                                <TableHead className="w-[110px] text-right font-bold">الحالة</TableHead>
                                <TableHead className="w-[70px] text-center font-bold">التفاصيل</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-40 text-center">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                                            <span className="text-sm text-muted-foreground">جاري تحميل سجلات النشاط...</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : paginatedLogs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-40 text-center">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Layers className="h-8 w-8 text-muted-foreground/50" />
                                            <span className="text-base font-bold text-muted-foreground">لا توجد سجلات تطابق الفلاتر المحددة</span>
                                            <span className="text-xs text-muted-foreground">جرب تغيير كلمات البحث أو إعادة ضبط الفلاتر</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedLogs.map((log) => {
                                    const { date, time } = formatDate(log.created_at)
                                    return (
                                        <TableRow key={log.id} className="hover:bg-muted/30 transition-colors">
                                            {/* Date & Time */}
                                            <TableCell className="w-[160px] font-mono text-xs text-muted-foreground whitespace-nowrap align-top py-3">
                                                <div className="font-bold text-foreground">{date}</div>
                                                <div className="text-[11px] text-muted-foreground/80">{time}</div>
                                            </TableCell>

                                            {/* User Info */}
                                            <TableCell className="w-[230px] align-top py-3">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-bold text-sm text-foreground truncate max-w-[140px]">
                                                            {log.user_name || "مستخدم"}
                                                        </span>
                                                        {getRoleBadge(log.user_role)}
                                                    </div>
                                                    {log.user_email && (
                                                        <span className="text-xs text-muted-foreground font-mono truncate max-w-[210px]" dir="ltr">
                                                            {log.user_email}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>

                                            {/* Action & Category */}
                                            <TableCell className="w-[210px] align-top py-3">
                                                <div className="flex flex-col gap-1.5">
                                                    <span className="font-bold text-sm text-foreground">
                                                        {log.title}
                                                    </span>
                                                    {getCategoryBadge(log.category)}
                                                </div>
                                            </TableCell>

                                            {/* Description (Scrollable on long messages, won't break layout) */}
                                            <TableCell className="w-[350px] align-top py-3">
                                                <div className="max-h-[85px] overflow-y-auto pr-1 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
                                                    {log.description}
                                                </div>
                                                {log.target_user_name && (
                                                    <span className="text-[11px] text-primary/80 font-medium block mt-1">
                                                        المستهدف: {log.target_user_name}
                                                    </span>
                                                )}
                                            </TableCell>

                                            {/* Amount */}
                                            <TableCell className="w-[120px] whitespace-nowrap align-top py-3">
                                                {typeof log.amount === "number" && log.amount > 0 ? (
                                                    <div className="font-mono font-bold text-sm text-emerald-600 flex items-center gap-0.5">
                                                        <span>+{log.amount.toLocaleString()}</span>
                                                        <span className="text-xs text-muted-foreground font-normal">ج.م</span>
                                                    </div>
                                                ) : typeof log.amount === "number" && log.amount < 0 ? (
                                                    <div className="font-mono font-bold text-sm text-rose-600 flex items-center gap-0.5">
                                                        <span>{log.amount.toLocaleString()}</span>
                                                        <span className="text-xs text-muted-foreground font-normal">ج.م</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground/60">—</span>
                                                )}
                                            </TableCell>

                                            {/* Status */}
                                            <TableCell className="w-[110px] align-top py-3">
                                                {getStatusBadge(log.status)}
                                            </TableCell>

                                            {/* Details Button */}
                                            <TableCell className="w-[70px] text-center align-top py-3">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setSelectedLog(log)}
                                                    className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                                                    title="معاينة التفاصيل الكاملة"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t bg-muted/10">
                        <div className="text-xs text-muted-foreground">
                            عرض من <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> إلى{" "}
                            <strong>{Math.min(currentPage * itemsPerPage, filteredLogs.length)}</strong> من إجمالي{" "}
                            <strong>{filteredLogs.length}</strong> سجل
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                className="h-8 gap-1 font-bold"
                            >
                                <ChevronRight className="w-4 h-4" />
                                <span>السابق</span>
                            </Button>
                            <span className="px-3 py-1 text-xs font-bold bg-background border rounded-md">
                                {currentPage} / {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                className="h-8 gap-1 font-bold"
                            >
                                <span>التالي</span>
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </Card>

            {/* Log Details Modal */}
            <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
                <DialogContent className="max-w-2xl font-arabic" dir="rtl">
                    <DialogHeader className="text-right">
                        <DialogTitle className="text-xl font-black flex items-center gap-2">
                            <Activity className="w-5 h-5 text-primary" />
                            <span>تفاصيل السجل الموثق</span>
                        </DialogTitle>
                        <DialogDescription>
                            كافة البيانات التقنية والمالية المرتبطة بهذا الحدث
                        </DialogDescription>
                    </DialogHeader>

                    {selectedLog && (
                        <div className="space-y-4 pt-2">
                            {/* Summary Grid */}
                            <div className="grid grid-cols-2 gap-3 bg-muted/30 p-4 rounded-xl border">
                                <div>
                                    <span className="text-xs text-muted-foreground block">نوع العملية:</span>
                                    <span className="font-bold text-sm text-foreground">{selectedLog.title}</span>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground block">الفئة:</span>
                                    <div className="mt-0.5">{getCategoryBadge(selectedLog.category)}</div>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground block">المستخدم:</span>
                                    <span className="font-bold text-sm text-foreground">{selectedLog.user_name || "مستخدم"}</span>
                                    <div className="mt-0.5">{getRoleBadge(selectedLog.user_role)}</div>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground block">البريد الإلكتروني:</span>
                                    <span className="font-mono text-xs text-muted-foreground" dir="ltr">{selectedLog.user_email || "N/A"}</span>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground block">الوقت والتاريخ:</span>
                                    <span className="font-mono text-xs text-foreground font-semibold">
                                        {new Date(selectedLog.created_at).toLocaleString("ar-EG")}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground block">الحالة:</span>
                                    <div className="mt-0.5">{getStatusBadge(selectedLog.status)}</div>
                                </div>
                                {typeof selectedLog.amount === "number" && (
                                    <div className="col-span-2 pt-2 border-t">
                                        <span className="text-xs text-muted-foreground block">المبلغ المالي المسجل:</span>
                                        <span className="font-mono text-lg font-black text-emerald-600">
                                            {selectedLog.amount} ج.م
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Description */}
                            <div className="bg-background p-4 rounded-xl border">
                                <span className="text-xs font-bold text-muted-foreground block mb-1">البيان الكامل:</span>
                                <p className="text-sm text-foreground leading-relaxed">
                                    {selectedLog.description}
                                </p>
                            </div>

                            {/* Error if present */}
                            {selectedLog.error_message && (
                                <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-rose-700 text-xs">
                                    <span className="font-bold block mb-1">رسالة الخطأ المسجلة:</span>
                                    <code className="font-mono">{selectedLog.error_message}</code>
                                </div>
                            )}

                            {/* Metadata / Technical payload */}
                            {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                                <div>
                                    <span className="text-xs font-bold text-muted-foreground block mb-1.5">
                                        البيانات الإضافية (Metadata JSON):
                                    </span>
                                    <pre className="bg-zinc-950 text-zinc-100 p-3 rounded-xl text-xs font-mono overflow-x-auto max-h-56 dir-ltr text-left" dir="ltr">
                                        {JSON.stringify(selectedLog.metadata, null, 2)}
                                    </pre>
                                </div>
                            )}

                            {/* Technical IDs */}
                            <div className="text-[11px] text-muted-foreground font-mono flex flex-wrap gap-x-4 gap-y-1 pt-2 border-t" dir="ltr">
                                <span>Log ID: {selectedLog.id}</span>
                                {selectedLog.user_id && <span>User ID: {selectedLog.user_id}</span>}
                                {selectedLog.action && <span>Action: {selectedLog.action}</span>}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
