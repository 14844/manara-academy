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
    Trash2,
    Printer
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
import { useAdminRole } from "@/components/admin/admin-role-context"
import { getRoleLabel as getPermissionRoleLabel, isStaffRole, type StaffRole } from "@/lib/permissions"

export interface ActivityLog {
    id: string;
    action: string;
    category: "financial" | "auth" | "admin_action" | "course" | "system" | "client" | "ai_support" | (string & {});
    title: string;
    description: string;
    status: "success" | "failed" | "pending" | "info" | "approved" | "rejected" | "completed" | "paid" | (string & {});
    user_id?: string;
    user_name?: string;
    user_email?: string;
    user_role?: "student" | "instructor" | "admin" | "system" | StaffRole | (string & {});
    target_user_id?: string;
    target_user_name?: string;
    amount?: number | null;
    metadata?: Record<string, any>;
    error_message?: string;
    created_at: string;
    timestamp?: number;
}

export default function AdminLogsPage() {
    const { can } = useAdminRole()
    const canClearLogs = can("logs.clear")
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
            // Fetch latest 2000 logs ordered by created_at desc
            let q = query(logsRef, orderBy("created_at", "desc"), limit(2000))
            
            let snap;
            try {
                snap = await getDocs(q)
            } catch (queryErr) {
                // If orderBy index is building or not yet available, fallback to simple fetch and sort in memory
                snap = await getDocs(query(logsRef, limit(2000)))
            }

            const rawLogs: ActivityLog[] = snap.docs.map(doc => ({
                id: doc.id,
                ...(doc.data() as any),
            }))

            // Sort safely in-memory desc
            rawLogs.sort((a, b) => {
                const timeA = new Date(a.created_at || a.timestamp || 0).getTime()
                const timeB = new Date(b.created_at || b.timestamp || 0).getTime()
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

    // Helper functions for classification
    const isLogFinancial = (log: ActivityLog): boolean => {
        return log.category === "financial" ||
            Boolean(log.action && /^(recharge|withdraw|payment|refund|wallet|payout|enroll|course_purchase)/i.test(log.action)) ||
            (typeof log.amount === "number" && log.amount > 0) ||
            Boolean(log.metadata?.paid_amount || log.metadata?.amount_added || log.metadata?.final_paid);
    }

    const isLogAuth = (log: ActivityLog): boolean => {
        return log.category === "auth" ||
            Boolean(log.action && /^(user_)?(login|signup|auth|session|password|device)/i.test(log.action));
    }

    const isLogFailed = (log: ActivityLog): boolean => {
        return log.status === "failed" ||
            log.status === "rejected" ||
            Boolean(log.error_message) ||
            Boolean(log.action && /failed|error|blocked|rejected/i.test(log.action));
    }

    const extractLogAmount = (log: ActivityLog): number => {
        if (typeof log.amount === "number" && !isNaN(log.amount)) return log.amount;
        if (typeof log.amount === "string" && !isNaN(Number(log.amount))) return Number(log.amount);
        const metaAmt = log.metadata?.paid_amount || log.metadata?.amount || log.metadata?.final_paid || log.metadata?.amount_added;
        if (metaAmt !== undefined && !isNaN(Number(metaAmt))) return Number(metaAmt);
        return 0;
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

            // Category filter with intelligent classification
            if (selectedCategory !== "all") {
                if (selectedCategory === "financial") {
                    if (!isLogFinancial(log)) return false
                } else if (selectedCategory === "auth") {
                    if (!isLogAuth(log)) return false
                } else if (log.category !== selectedCategory) {
                    return false
                }
            }

            // Status filter
            if (selectedStatus !== "all") {
                if (selectedStatus === "failed") {
                    if (!isLogFailed(log)) return false
                } else if (selectedStatus === "success") {
                    if (log.status !== "success" && log.status !== "approved" && log.status !== "completed") return false
                } else if (log.status !== selectedStatus) {
                    return false
                }
            }

            // Time range filter
            if (selectedTimeRange !== "all") {
                const logTime = new Date(log.created_at || log.timestamp || 0).getTime()
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

    // Statistics - computed dynamically from filteredLogs so KPI cards are 100% accurate to the active view!
    const stats = useMemo(() => {
        let totalFinancialAmount = 0
        let financialCount = 0
        let authCount = 0
        let failedCount = 0

        filteredLogs.forEach(log => {
            if (isLogFinancial(log)) {
                financialCount++
                const isSuccess = log.status === "success" || log.status === "approved" || log.status === "completed" || log.status === "paid" || !log.status;
                const amt = extractLogAmount(log)
                if (isSuccess && amt > 0) {
                    totalFinancialAmount += amt
                }
            }
            if (isLogAuth(log)) {
                authCount++
            }
            if (isLogFailed(log)) {
                failedCount++
            }
        })

        return {
            total: filteredLogs.length,
            allTotal: logs.length,
            financialCount,
            totalFinancialAmount,
            authCount,
            failedCount,
        }
    }, [logs, filteredLogs])

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

    // Export / Print formatted PDF
    function handlePrintPDF() {
        if (!filteredLogs.length) {
            toast.error("لا توجد سجلات لطباعتها أو تصديرها كـ PDF")
            return
        }

        const windowUrl = 'about:blank'
        const uniqueName = new Date().getTime()
        const windowName = 'AdminLogsReport_' + uniqueName
        const printWindow = window.open(windowUrl, windowName, 'left=50000,top=50000,width=0,height=0')

        if (!printWindow) {
            alert("يرجى تفعيل السماح بالنوافذ المنبثقة (Popups) لتصدير التقرير كـ PDF")
            return
        }

        const dateStr = new Date().toLocaleDateString("ar-EG", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        })

        // Print up to 300 logs for smooth browser rendering
        const printItems = filteredLogs.slice(0, 300)

        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
                <head>
                    <meta charset="utf-8">
                    <title>تقرير سجلات نشاط وحركات المنصة - أكاديمية المنارة</title>
                    <style>
                        @page { size: A4 landscape; margin: 10mm 12mm; }
                        * { box-sizing: border-box; }
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                            direction: rtl;
                            background: #ffffff;
                            color: #0f172a;
                            margin: 0;
                            padding: 16px;
                            font-size: 11px;
                            line-height: 1.4;
                        }
                        .report-container {
                            border: 2px solid #e2e8f0;
                            border-radius: 14px;
                            padding: 20px;
                            max-width: 1100px;
                            margin: 0 auto;
                        }
                        .header {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            border-bottom: 2px solid #e2e8f0;
                            padding-bottom: 14px;
                            margin-bottom: 16px;
                        }
                        .header h1 {
                            margin: 0;
                            font-size: 20px;
                            font-weight: 900;
                            color: #0f172a;
                        }
                        .header p {
                            margin: 3px 0 0;
                            color: #64748b;
                            font-size: 11px;
                            font-weight: 600;
                        }
                        .kpi-row {
                            display: grid;
                            grid-template-columns: repeat(4, 1fr);
                            gap: 10px;
                            margin-bottom: 18px;
                        }
                        .kpi-card {
                            border: 1px solid #cbd5e1;
                            background: #f8fafc;
                            border-radius: 10px;
                            padding: 10px;
                            text-align: center;
                        }
                        .kpi-card .val {
                            font-size: 18px;
                            font-weight: 900;
                            color: #0f172a;
                        }
                        .kpi-card .lbl {
                            font-size: 10px;
                            font-weight: 700;
                            color: #64748b;
                            margin-top: 1px;
                        }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-top: 6px;
                            font-size: 10.5px;
                        }
                        th {
                            background: #f1f5f9;
                            color: #334155;
                            font-weight: 800;
                            text-align: right;
                            padding: 8px 10px;
                            border: 1px solid #cbd5e1;
                        }
                        td {
                            padding: 7px 10px;
                            border: 1px solid #e2e8f0;
                            color: #1e293b;
                            vertical-align: top;
                        }
                        tr:nth-child(even) td { background: #fafafa; }
                        .badge {
                            display: inline-block;
                            padding: 2px 6px;
                            border-radius: 4px;
                            font-size: 9.5px;
                            font-weight: 700;
                        }
                        .badge-success { background: #dcfce7; color: #15803d; }
                        .badge-failed { background: #fee2e2; color: #991b1b; }
                        .badge-info { background: #f1f5f9; color: #475569; }
                        .footer {
                            margin-top: 30px;
                            padding-top: 14px;
                            border-top: 1px dashed #cbd5e1;
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-end;
                            font-size: 11px;
                        }
                        .stamp-block {
                            text-align: center;
                            min-width: 160px;
                        }
                        .stamp-line {
                            height: 50px;
                            border-bottom: 1px solid #94a3b8;
                            margin-bottom: 4px;
                        }
                    </style>
                </head>
                <body>
                    <div class="report-container">
                        <div class="header">
                            <div>
                                <h1>أكاديمية المنارة التعليمية - سجلات الرقابة والنشاط</h1>
                                <p>تقرير تدقيق العمليات وحركات النظام (Audit & Activity Logs Report)</p>
                            </div>
                            <div style="text-align: left; font-size: 10px; color: #64748b;">
                                <div><strong>تاريخ الاستخراج:</strong> ${dateStr}</div>
                                <div><strong>العدد المعروض:</strong> ${printItems.length} من إجمالي ${filteredLogs.length} حركة مطابقة</div>
                            </div>
                        </div>

                        <div class="kpi-row">
                            <div class="kpi-card">
                                <div class="val">${stats.total.toLocaleString()}</div>
                                <div class="lbl">إجمالي الحركات المفلترة</div>
                            </div>
                            <div class="kpi-card">
                                <div class="val" style="color: #16a34a;">${stats.totalFinancialAmount.toLocaleString()} ج.م</div>
                                <div class="lbl">المعاملات المالية الناجحة (${stats.financialCount})</div>
                            </div>
                            <div class="kpi-card">
                                <div class="val" style="color: #4f46e5;">${stats.authCount.toLocaleString()}</div>
                                <div class="lbl">عمليات الدخول والتسجيل</div>
                            </div>
                            <div class="kpi-card">
                                <div class="val" style="color: ${stats.failedCount > 0 ? '#dc2626' : '#16a34a'};">${stats.failedCount}</div>
                                <div class="lbl">العمليات الفاشلة / التنبيهات</div>
                            </div>
                        </div>

                        <table>
                            <thead>
                                <tr>
                                    <th style="width: 120px;">الوقت والتاريخ</th>
                                    <th style="width: 140px;">المستخدم / المنفذ</th>
                                    <th style="width: 80px;">الدور</th>
                                    <th style="width: 90px;">الفئة</th>
                                    <th style="width: 140px;">نوع الحركة</th>
                                    <th>التفاصيل والبيان</th>
                                    <th style="width: 85px;">المبلغ</th>
                                    <th style="width: 70px;">الحالة</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${printItems.map((l) => {
                                    const timeFormatted = new Date(l.created_at || l.timestamp || 0).toLocaleString("ar-EG", {
                                        month: "numeric",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    });
                                    const statusClass = (l.status === "success" || l.status === "approved" || l.status === "completed") ? "badge-success" : (isLogFailed(l) ? "badge-failed" : "badge-info");
                                    const statusText = getStatusLabel(l.status);
                                    const amtNum = extractLogAmount(l);
                                    const amountFormatted = amtNum > 0 ? `${amtNum.toLocaleString()} ج.م` : "-";

                                    return `
                                        <tr>
                                            <td style="color: #64748b; font-size: 10px;">${timeFormatted}</td>
                                            <td><strong>${l.user_name || "مستخدم"}</strong><div style="color:#64748b; font-size:9px;">${l.user_email || ""}</div></td>
                                            <td>${getRoleLabel(l.user_role)}</td>
                                            <td>${getCategoryLabel(l.category)}</td>
                                            <td style="font-weight: 700;">${l.title || l.action}</td>
                                            <td style="color: #334155;">${l.description || l.action}</td>
                                            <td style="font-weight: 800; color: #0f172a; text-align: center;">${amountFormatted}</td>
                                            <td style="text-align: center;"><span class="badge ${statusClass}">${statusText}</span></td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>

                        <div class="footer">
                            <div>
                                <p style="margin: 0; font-weight: 700;">أكاديمية المنارة للتعليم الإلكتروني الذكي © 2026</p>
                                <p style="margin: 2px 0 0; color: #64748b; font-size: 10px;">سجل رقابي رسمي للعمليات معتمد لأغراض الأمان والرقابة المالية والإدارية.</p>
                            </div>
                            <div class="stamp-block">
                                <div class="stamp-line"></div>
                                <div>توقيع مسؤول الرقابة والتدقيق</div>
                            </div>
                            <div class="stamp-block">
                                <div class="stamp-line"></div>
                                <div>اعتماد الإدارة العليا / الختم</div>
                            </div>
                        </div>
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 300);
    }

    // Clear all logs
    async function handleClearLogs() {
        if (!canClearLogs) return
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
                if (isStaffRole(role)) {
                    return <Badge className="bg-amber-500/10 text-amber-700 border-amber-200">{getPermissionRoleLabel(role)}</Badge>
                }
                return <Badge variant="outline">مستخدم</Badge>
        }
    }

    function getRoleLabel(role?: string) {
        switch (role) {
            case "admin": return "مسؤول"
            case "instructor": return "محاضر"
            case "student": return "طالب"
            case "system": return "النظام"
            default: return isStaffRole(role) ? getPermissionRoleLabel(role) : "مستخدم"
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
            case "client":
                return (
                    <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        <span>نشاط مستخدم</span>
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
            case "client": return "نشاط مستخدم / واجهة"
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
                    {canClearLogs && (
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
                    )}
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
                        variant="outline"
                        size="sm"
                        onClick={handlePrintPDF}
                        className="gap-2 font-bold hover:bg-zinc-100"
                    >
                        <Printer className="w-4 h-4 text-primary" />
                        <span>طباعة / تصدير PDF</span>
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
                        <p className="text-xs text-muted-foreground mt-1">
                            {filteredLogs.length !== stats.allTotal ? `حركة مطابقة للفلتر (من أصل ${stats.allTotal.toLocaleString()})` : "عملية موثقة في قاعدة البيانات"}
                        </p>
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
                                    <SelectItem value="client">نشاط مستخدمين وتفاعل</SelectItem>
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
