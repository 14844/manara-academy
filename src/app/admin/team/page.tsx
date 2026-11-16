"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    Activity,
    Ban,
    CalendarDays,
    Clock,
    Info,
    Loader2,
    Lock,
    PlayCircle,
    RefreshCw,
    Search,
    ShieldCheck,
    UserCog,
    UserPlus,
    Users,
} from "lucide-react"
import { toast } from "sonner"
import { TablePageSkeleton } from "@/components/skeletons"
import { useAdminRole } from "@/components/admin/admin-role-context"
import { getRoleLabel, ROLE_LABELS, STAFF_ROLES, type UserRole } from "@/lib/permissions"

interface TeamMember {
    id: string
    full_name: string
    email: string
    phone?: string
    avatar_url?: string
    role: UserRole
    status: string
    last_login: string | null
    is_self: boolean
    count_7d: number
    count_30d: number
    last_action_at: string | null
    last_action_title: string | null
}

interface ActivityLogItem {
    id: string
    action: string
    category: string
    title: string
    description: string
    status: string
    created_at: string
    target_user_name?: string
    amount?: number | null
}

interface LookupUser {
    id: string
    full_name: string
    email: string
    role: UserRole
    status: string | null
    is_self: boolean
}

const ALL_ROLES = Object.keys(ROLE_LABELS) as UserRole[]
const TEAM_ASSIGNABLE_ROLES: UserRole[] = [...STAFF_ROLES, "admin"]

const CATEGORY_LABELS: Record<string, string> = {
    admin_action: "إجراءات إدارية",
    financial: "مالية",
    auth: "تسجيل الدخول",
    course: "الكورسات",
    system: "النظام",
    client: "واجهة المستخدم",
    ai_support: "الدعم الذكي",
}

const LOG_STATUS_CLASS: Record<string, string> = {
    success: "text-green-600 border-green-200 bg-green-50",
    failed: "text-red-600 border-red-200 bg-red-50",
    pending: "text-orange-600 border-orange-200 bg-orange-50",
    info: "text-blue-600 border-blue-200 bg-blue-50",
}

function isSuspendedStatus(status: string) {
    return status === "suspended" || status === "blocked" || status === "rejected"
}

function statusLabel(status: string) {
    switch (status) {
        case "active":
        case "approved":
            return "نشط"
        case "suspended":
            return "موقوف"
        case "blocked":
            return "محظور"
        case "rejected":
            return "مرفوض"
        case "pending":
            return "قيد المراجعة"
        default:
            return status || "نشط"
    }
}

function formatDateTime(value: string | null | undefined) {
    if (!value) return "—"
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" })
}

async function postUserAction(body: Record<string, unknown>) {
    const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || "فشل تنفيذ الإجراء")
    return data
}

export default function AdminTeamPage() {
    const { can } = useAdminRole()
    const canView = can("team.view")
    const canManageRoles = can("users.manage_roles")
    const canManageStatus = can("users.manage_status")

    const [members, setMembers] = useState<TeamMember[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [search, setSearch] = useState("")

    // Role change confirm
    const [pendingRole, setPendingRole] = useState<{ id: string; name: string; from: UserRole; to: UserRole } | null>(null)
    const [savingRole, setSavingRole] = useState(false)

    // Suspend / reactivate confirm
    const [pendingStatus, setPendingStatus] = useState<{ member: TeamMember; status: "suspended" | "active" } | null>(null)
    const [savingStatus, setSavingStatus] = useState(false)

    // Add member
    const [addOpen, setAddOpen] = useState(false)
    const [lookupEmail, setLookupEmail] = useState("")
    const [lookupLoading, setLookupLoading] = useState(false)
    const [lookupResult, setLookupResult] = useState<LookupUser | null>(null)
    const [lookupRole, setLookupRole] = useState<UserRole>("support_team")

    // Activity timeline
    const [selected, setSelected] = useState<TeamMember | null>(null)
    const [logs, setLogs] = useState<ActivityLogItem[]>([])
    const [logsLoading, setLogsLoading] = useState(false)
    const [nextCursor, setNextCursor] = useState<string | null>(null)
    const [categoryFilter, setCategoryFilter] = useState("all")
    const [fromDate, setFromDate] = useState("")
    const [toDate, setToDate] = useState("")

    const fetchMembers = useCallback(async (silent = false) => {
        if (silent) setRefreshing(true)
        else setLoading(true)
        try {
            const res = await fetch("/api/admin/team")
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data.error || "فشل تحميل فريق العمل")
            setMembers(data.members || [])
        } catch (error: any) {
            toast.error(error.message || "حدث خطأ أثناء تحميل فريق العمل")
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [])

    useEffect(() => {
        if (canView) fetchMembers()
        else setLoading(false)
    }, [canView, fetchMembers])

    const fetchLogs = useCallback(
        async (member: TeamMember, cursor: string | null) => {
            setLogsLoading(true)
            try {
                const params = new URLSearchParams({ userId: member.id })
                if (cursor) params.set("cursor", cursor)
                if (categoryFilter !== "all") params.set("category", categoryFilter)
                if (fromDate) params.set("from", fromDate)
                if (toDate) params.set("to", toDate)
                const res = await fetch(`/api/admin/team/activity?${params.toString()}`)
                const data = await res.json().catch(() => ({}))
                if (!res.ok) throw new Error(data.error || "فشل تحميل سجل النشاط")
                setLogs((prev) => (cursor ? [...prev, ...(data.logs || [])] : data.logs || []))
                setNextCursor(data.nextCursor || null)
            } catch (error: any) {
                toast.error(error.message || "حدث خطأ أثناء تحميل سجل النشاط")
            } finally {
                setLogsLoading(false)
            }
        },
        [categoryFilter, fromDate, toDate]
    )

    // Reload the timeline whenever the selected member or a filter changes
    useEffect(() => {
        if (!selected) return
        setLogs([])
        setNextCursor(null)
        fetchLogs(selected, null)
    }, [selected, fetchLogs])

    const filteredMembers = useMemo(() => {
        const term = search.trim().toLowerCase()
        if (!term) return members
        return members.filter(
            (m) =>
                m.full_name?.toLowerCase().includes(term) ||
                m.email?.toLowerCase().includes(term) ||
                getRoleLabel(m.role).includes(term)
        )
    }, [members, search])

    const stats = useMemo(() => {
        const active = members.filter((m) => !isSuspendedStatus(m.status)).length
        const actions7 = members.reduce((sum, m) => sum + (m.count_7d || 0), 0)
        return { total: members.length, active, suspended: members.length - active, actions7 }
    }, [members])

    const confirmRoleChange = async () => {
        if (!pendingRole) return
        setSavingRole(true)
        try {
            await postUserAction({ userId: pendingRole.id, action: "set_role", role: pendingRole.to })
            toast.success(`تم تغيير دور ${pendingRole.name} إلى ${getRoleLabel(pendingRole.to)}`)
            setPendingRole(null)
            setAddOpen(false)
            setLookupResult(null)
            setLookupEmail("")
            await fetchMembers(true)
            if (selected && selected.id === pendingRole.id && pendingRole.to !== "admin" && !(STAFF_ROLES as readonly string[]).includes(pendingRole.to)) {
                setSelected(null)
            }
        } catch (error: any) {
            toast.error(error.message || "حدث خطأ أثناء تغيير الدور")
        } finally {
            setSavingRole(false)
        }
    }

    const confirmStatusChange = async () => {
        if (!pendingStatus) return
        setSavingStatus(true)
        try {
            await postUserAction({ userId: pendingStatus.member.id, action: "update_status", status: pendingStatus.status })
            setMembers((prev) => prev.map((m) => (m.id === pendingStatus.member.id ? { ...m, status: pendingStatus.status } : m)))
            toast.success(pendingStatus.status === "suspended" ? "تم إيقاف حساب العضو" : "تم إعادة تفعيل حساب العضو")
            setPendingStatus(null)
        } catch (error: any) {
            toast.error(error.message || "حدث خطأ أثناء تحديث الحالة")
        } finally {
            setSavingStatus(false)
        }
    }

    const handleLookup = async () => {
        const email = lookupEmail.trim()
        if (!email) return
        setLookupLoading(true)
        setLookupResult(null)
        try {
            const res = await fetch(`/api/admin/team/lookup?email=${encodeURIComponent(email)}`)
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data.error || "لم يتم العثور على المستخدم")
            setLookupResult(data.user)
            setLookupRole((STAFF_ROLES as readonly string[]).includes(data.user.role) ? data.user.role : "support_team")
        } catch (error: any) {
            toast.error(error.message || "لم يتم العثور على المستخدم")
        } finally {
            setLookupLoading(false)
        }
    }

    if (loading) {
        return <TablePageSkeleton rowCount={8} />
    }

    if (!canView) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center gap-3 font-arabic">
                <Lock className="h-10 w-10 text-muted-foreground" />
                <p className="text-lg font-bold">هذه الصفحة متاحة لمدير المنصة فقط</p>
            </div>
        )
    }

    return (
        <div className="space-y-8 font-arabic">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <UserCog className="h-7 w-7 text-primary" />
                        فريق العمل
                    </h1>
                    <p className="text-muted-foreground">أعضاء الإدارة وفريق العمل، وماذا فعل كل عضو على المنصة</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="بحث بالاسم أو الإيميل أو الدور..."
                            className="pr-10"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" className="gap-2" onClick={() => fetchMembers(true)} disabled={refreshing}>
                        <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                        تحديث
                    </Button>
                    {canManageRoles && (
                        <Button className="gap-2" onClick={() => setAddOpen(true)}>
                            <UserPlus className="h-4 w-4" />
                            إضافة عضو
                        </Button>
                    )}
                </div>
            </div>

            <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900">
                <CardContent className="p-4 flex items-start gap-3 text-sm">
                    <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        <p className="font-bold text-blue-700 dark:text-blue-400">كيف تضيف موظف؟</p>
                        <p className="text-muted-foreground">
                            اطلب من الموظف أن ينشئ حسابًا عاديًا على المنصة أولًا (تسجيل جديد بإيميله)، ثم اضغط
                            &quot;إضافة عضو&quot; هنا وابحث عنه بالإيميل واختر له الدور المناسب. سيتم تفعيل حسابه تلقائيًا،
                            وتُطبق صلاحيات الدور الجديد عند تسجيل دخوله التالي.
                        </p>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatTile title="إجمالي الأعضاء" value={stats.total} icon={Users} color="text-primary" />
                <StatTile title="حسابات نشطة" value={stats.active} icon={ShieldCheck} color="text-green-600" />
                <StatTile title="حسابات موقوفة" value={stats.suspended} icon={Ban} color="text-red-600" />
                <StatTile title="إجراءات آخر 7 أيام" value={stats.actions7} icon={Activity} color="text-blue-600" />
            </div>

            <div className="grid gap-4">
                {filteredMembers.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed rounded-2xl text-muted-foreground">
                        لا يوجد أعضاء مطابقون
                    </div>
                ) : (
                    filteredMembers.map((member) => {
                        const suspended = isSuspendedStatus(member.status)
                        const avatar =
                            member.avatar_url ||
                            `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(member.full_name || member.id)}`
                        return (
                            <Card key={member.id} className={`transition-shadow hover:shadow-md ${suspended ? "opacity-75" : ""}`}>
                                <CardContent className="p-5">
                                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                        <button
                                            type="button"
                                            className="flex items-start gap-4 text-right min-w-0"
                                            onClick={() => setSelected(member)}
                                        >
                                            <div className="h-12 w-12 rounded-full overflow-hidden border-2 border-primary/10 shrink-0 bg-primary/10">
                                                <img src={avatar} alt="" className="w-full h-full object-cover" />
                                            </div>
                                            <div className="space-y-1 min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 className="text-lg font-bold truncate">{member.full_name || "بدون اسم"}</h3>
                                                    <Badge variant={member.role === "admin" ? "default" : "secondary"}>
                                                        {getRoleLabel(member.role)}
                                                    </Badge>
                                                    <Badge
                                                        variant="outline"
                                                        className={suspended ? "text-red-600 border-red-200 bg-red-50" : "text-green-600 border-green-200 bg-green-50"}
                                                    >
                                                        {statusLabel(member.status)}
                                                    </Badge>
                                                    {member.is_self && <Badge variant="outline">أنت</Badge>}
                                                </div>
                                                <p className="text-sm text-muted-foreground truncate" dir="ltr">{member.email}</p>
                                                <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3.5 w-3.5" />
                                                        آخر دخول: {formatDateTime(member.last_login)}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Activity className="h-3.5 w-3.5" />
                                                        آخر إجراء: {member.last_action_title ? `${member.last_action_title} — ${formatDateTime(member.last_action_at)}` : "لا يوجد"}
                                                    </span>
                                                </div>
                                            </div>
                                        </button>

                                        <div className="flex flex-wrap items-center gap-3 shrink-0">
                                            <div className="flex gap-2 text-center">
                                                <div className="rounded-lg border px-3 py-1.5">
                                                    <p className="text-lg font-bold">{member.count_7d}</p>
                                                    <p className="text-[10px] text-muted-foreground">آخر 7 أيام</p>
                                                </div>
                                                <div className="rounded-lg border px-3 py-1.5">
                                                    <p className="text-lg font-bold">{member.count_30d}</p>
                                                    <p className="text-[10px] text-muted-foreground">آخر 30 يوم</p>
                                                </div>
                                            </div>

                                            {canManageRoles && !member.is_self && (
                                                <Select
                                                    value={member.role}
                                                    onValueChange={(value) => {
                                                        if (value === member.role) return
                                                        setPendingRole({
                                                            id: member.id,
                                                            name: member.full_name || member.email,
                                                            from: member.role,
                                                            to: value as UserRole,
                                                        })
                                                    }}
                                                >
                                                    <SelectTrigger className="w-[150px] h-9">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {ALL_ROLES.map((r) => (
                                                            <SelectItem key={r} value={r}>
                                                                {ROLE_LABELS[r]}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}

                                            {canManageStatus && !member.is_self && (
                                                suspended ? (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-9 gap-2 text-green-600 border-green-200 hover:bg-green-50"
                                                        onClick={() => setPendingStatus({ member, status: "active" })}
                                                    >
                                                        <PlayCircle className="h-4 w-4" />
                                                        إعادة تفعيل
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-9 gap-2 text-red-600 border-red-200 hover:bg-red-50"
                                                        onClick={() => setPendingStatus({ member, status: "suspended" })}
                                                    >
                                                        <Ban className="h-4 w-4" />
                                                        إيقاف
                                                    </Button>
                                                )
                                            )}

                                            <Button variant="secondary" size="sm" className="h-9 gap-2" onClick={() => setSelected(member)}>
                                                <Activity className="h-4 w-4" />
                                                سجل النشاط
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })
                )}
            </div>

            {/* Activity timeline */}
            <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
                <SheetContent side="left" className="w-full sm:max-w-2xl overflow-y-auto font-arabic" dir="rtl">
                    <SheetHeader className="text-right">
                        <SheetTitle className="text-xl">سجل نشاط {selected?.full_name || selected?.email}</SheetTitle>
                        <SheetDescription>
                            {selected ? `${getRoleLabel(selected.role)} • آخر 7 أيام: ${selected.count_7d} • آخر 30 يوم: ${selected.count_30d}` : ""}
                        </SheetDescription>
                    </SheetHeader>

                    <div className="px-4 pb-4 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs">التصنيف</Label>
                                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                    <SelectTrigger className="h-9 w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">كل التصنيفات</SelectItem>
                                        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                                            <SelectItem key={value} value={value}>
                                                {label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">من تاريخ</Label>
                                <Input type="date" className="h-9" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">إلى تاريخ</Label>
                                <Input type="date" className="h-9" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} />
                            </div>
                        </div>
                        {(categoryFilter !== "all" || fromDate || toDate) && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setCategoryFilter("all")
                                    setFromDate("")
                                    setToDate("")
                                }}
                            >
                                مسح الفلاتر
                            </Button>
                        )}

                        {logs.length === 0 && logsLoading ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : logs.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed rounded-2xl text-muted-foreground">
                                لا توجد نشاطات مسجلة
                            </div>
                        ) : (
                            <ol className="relative border-r-2 border-muted pr-5 space-y-4">
                                {logs.map((log) => (
                                    <li key={log.id} className="relative">
                                        <span className="absolute -right-[27px] top-1.5 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
                                        <div className="rounded-xl border p-3 space-y-1.5 bg-card">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <p className="font-bold text-sm">{log.title || log.action}</p>
                                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <CalendarDays className="h-3.5 w-3.5" />
                                                    {formatDateTime(log.created_at)}
                                                </span>
                                            </div>
                                            {log.description && <p className="text-sm text-muted-foreground">{log.description}</p>}
                                            <div className="flex flex-wrap gap-1.5">
                                                <Badge variant="outline" className="text-[10px]">
                                                    {CATEGORY_LABELS[log.category] || log.category}
                                                </Badge>
                                                {log.status && (
                                                    <Badge variant="outline" className={`text-[10px] ${LOG_STATUS_CLASS[log.status] || ""}`}>
                                                        {log.status}
                                                    </Badge>
                                                )}
                                                {log.target_user_name && (
                                                    <Badge variant="secondary" className="text-[10px]">
                                                        على: {log.target_user_name}
                                                    </Badge>
                                                )}
                                                {typeof log.amount === "number" && (
                                                    <Badge variant="secondary" className="text-[10px]">
                                                        {log.amount} ج.م
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        )}

                        {nextCursor && (
                            <Button
                                variant="outline"
                                className="w-full"
                                disabled={logsLoading}
                                onClick={() => selected && fetchLogs(selected, nextCursor)}
                            >
                                {logsLoading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                                تحميل المزيد
                            </Button>
                        )}
                    </div>
                </SheetContent>
            </Sheet>

            {/* Role change confirm */}
            <Dialog open={!!pendingRole} onOpenChange={(open) => !open && !savingRole && setPendingRole(null)}>
                <DialogContent className="sm:max-w-[440px] font-arabic">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">تأكيد تغيير الدور</DialogTitle>
                        <DialogDescription>
                            {pendingRole &&
                                `تغيير دور ${pendingRole.name} من ${getRoleLabel(pendingRole.from)} إلى ${getRoleLabel(pendingRole.to)}؟`}
                            <br />
                            <span className="text-xs">سيتم تسجيل خروج المستخدم لتطبيق الصلاحيات الجديدة عند دخوله التالي.</span>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPendingRole(null)} disabled={savingRole}>
                            إلغاء
                        </Button>
                        <Button onClick={confirmRoleChange} disabled={savingRole} className="font-bold">
                            {savingRole && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                            تأكيد التغيير
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Suspend / reactivate confirm */}
            <Dialog open={!!pendingStatus} onOpenChange={(open) => !open && !savingStatus && setPendingStatus(null)}>
                <DialogContent className="sm:max-w-[440px] font-arabic">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">
                            {pendingStatus?.status === "suspended" ? "إيقاف حساب عضو" : "إعادة تفعيل حساب عضو"}
                        </DialogTitle>
                        <DialogDescription>
                            {pendingStatus?.status === "suspended"
                                ? `سيتم إيقاف حساب ${pendingStatus?.member.full_name || pendingStatus?.member.email} فورًا ولن يتمكن من الدخول للوحة الإدارة.`
                                : `سيتم إعادة تفعيل حساب ${pendingStatus?.member.full_name || pendingStatus?.member.email}.`}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPendingStatus(null)} disabled={savingStatus}>
                            إلغاء
                        </Button>
                        <Button
                            variant={pendingStatus?.status === "suspended" ? "destructive" : "default"}
                            onClick={confirmStatusChange}
                            disabled={savingStatus}
                            className="font-bold"
                        >
                            {savingStatus && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                            تأكيد
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add member */}
            <Dialog
                open={addOpen}
                onOpenChange={(open) => {
                    setAddOpen(open)
                    if (!open) {
                        setLookupResult(null)
                        setLookupEmail("")
                    }
                }}
            >
                <DialogContent className="sm:max-w-[480px] font-arabic">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">إضافة عضو لفريق العمل</DialogTitle>
                        <DialogDescription>
                            ابحث عن مستخدم مسجل بالفعل على المنصة بالإيميل، ثم اختر الدور الذي تريد منحه له.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="flex gap-2">
                            <Input
                                type="email"
                                dir="ltr"
                                placeholder="name@example.com"
                                value={lookupEmail}
                                onChange={(e) => setLookupEmail(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                            />
                            <Button onClick={handleLookup} disabled={lookupLoading || !lookupEmail.trim()} className="gap-2 shrink-0">
                                {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                بحث
                            </Button>
                        </div>

                        {lookupResult && (
                            <div className="rounded-xl border p-4 space-y-3">
                                <div>
                                    <p className="font-bold">{lookupResult.full_name || "بدون اسم"}</p>
                                    <p className="text-sm text-muted-foreground" dir="ltr">{lookupResult.email}</p>
                                    <p className="text-xs text-muted-foreground mt-1">الدور الحالي: {getRoleLabel(lookupResult.role)}</p>
                                </div>
                                {lookupResult.is_self ? (
                                    <p className="text-sm text-red-600">لا يمكنك تغيير دورك بنفسك.</p>
                                ) : (
                                    <div className="space-y-1">
                                        <Label className="text-xs">الدور الجديد</Label>
                                        <Select value={lookupRole} onValueChange={(v) => setLookupRole(v as UserRole)}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {TEAM_ASSIGNABLE_ROLES.map((r) => (
                                                    <SelectItem key={r} value={r}>
                                                        {ROLE_LABELS[r]}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddOpen(false)}>
                            إلغاء
                        </Button>
                        <Button
                            disabled={!lookupResult || lookupResult.is_self || lookupResult.role === lookupRole}
                            onClick={() =>
                                lookupResult &&
                                setPendingRole({
                                    id: lookupResult.id,
                                    name: lookupResult.full_name || lookupResult.email,
                                    from: lookupResult.role,
                                    to: lookupRole,
                                })
                            }
                            className="font-bold gap-2"
                        >
                            <UserPlus className="h-4 w-4" />
                            تعيين الدور
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function StatTile({ title, value, icon: Icon, color }: { title: string; value: number; icon: React.ElementType; color: string }) {
    return (
        <Card>
            <CardContent className="pt-6 flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-muted-foreground">{title}</p>
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                </div>
                <div className="p-3 rounded-full bg-muted">
                    <Icon className={`h-5 w-5 ${color}`} />
                </div>
            </CardContent>
        </Card>
    )
}
