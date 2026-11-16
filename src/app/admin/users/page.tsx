"use client"

import { useState, useEffect } from "react"
import { db } from "@/lib/firebase/config"
import { collection, query, getDocs, orderBy } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Users,
    CheckCircle2,
    XCircle,
    Mail,
    Phone,
    User,
    GraduationCap,
    School,
    ShieldCheck,
    Search,
    Loader2,
    Wallet,
    Fingerprint,
    PlusCircle,
    Calendar
} from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { auth } from "@/lib/firebase/config"
import { logActivity, type ActivityLogInput } from "@/lib/activity-logger"
import { TablePageSkeleton } from "@/components/skeletons"
import { useAdminRole } from "@/components/admin/admin-role-context"
import { getRoleLabel, isBackofficeRole, ROLE_LABELS, type UserRole } from "@/lib/permissions"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const ALL_ROLES = Object.keys(ROLE_LABELS) as UserRole[]

export default function AdminUsersPage() {
    const { role, roleLabel, isAdmin, can } = useAdminRole()
    const canViewWallet = can("wallet.view")
    const canAdjustWallet = can("wallet.adjust")
    const canManageStatus = can("users.manage_status")
    const canVerify = can("users.verify")
    const canViewContact = can("users.view_contact")
    const canManageRoles = can("users.manage_roles")
    const [roleFilter, setRoleFilter] = useState<string>("all")
    const [pendingRoleChange, setPendingRoleChange] = useState<{ user: any; to: UserRole } | null>(null)
    const [isChangingRole, setIsChangingRole] = useState(false)
    // Role sent with client-side activity logs (the server re-derives it from the session anyway)
    const logRole = (role || "admin") as ActivityLogInput["user_role"]
    const [users, setUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedUserForRecharge, setSelectedUserForRecharge] = useState<any>(null)
    const [selectedUserForWithdraw, setSelectedUserForWithdraw] = useState<any>(null)
    const [rechargeAmount, setRechargeAmount] = useState("")
    const [withdrawAmount, setWithdrawAmount] = useState("")
    const [isRecharging, setIsRecharging] = useState(false)
    const [isWithdrawing, setIsWithdrawing] = useState(false)

    useEffect(() => {
        fetchUsers()
    }, [])

    async function fetchUsers() {
        setLoading(true)
        try {
            const res = await fetch("/api/admin/users")
            if (res.ok) {
                const data = await res.json()
                setUsers(data.users || [])
                return
            }
            // Direct Firestore fallback only for the admin: for staff the API is the single source,
            // because it strips contact / wallet fields their role is not allowed to see.
            if (!isAdmin) {
                throw new Error("users api failed")
            }
            const q = query(collection(db, "profiles"), orderBy("created_at", "desc"))
            const querySnapshot = await getDocs(q)
            const usersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            setUsers(usersData)
        } catch (error) {
            console.error("Error fetching users:", error)
            toast.error("حدث خطأ أثناء تحميل بيانات المستخدمين")
        } finally {
            setLoading(false)
        }
    }

    const handleManualRecharge = async () => {
        if (!selectedUserForRecharge || !rechargeAmount || Number(rechargeAmount) <= 0) return

        setIsRecharging(true)
        try {
            const res = await fetch("/api/admin/wallet/adjust", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    targetUserId: selectedUserForRecharge.id,
                    amount: Number(rechargeAmount),
                    type: "recharge",
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "فشل تعديل الرصيد")

            setUsers(users.map(u =>
                u.id === selectedUserForRecharge.id
                    ? { ...u, wallet_balance: (u.wallet_balance || 0) + Number(rechargeAmount) }
                    : u
            ))

            toast.success(`تم إضافة ${rechargeAmount} ج.م لمحفظة ${selectedUserForRecharge.full_name}`)
            
            // Log activity
            const currentAdmin = auth.currentUser;
            logActivity({
                action: "admin_manual_recharge",
                category: "financial",
                title: "شحن رصيد يدوي بواسطة الإدارة",
                description: `قام ${roleLabel} بشحن مبلغ ${rechargeAmount} ج.م مباشرة إلى محفظة المستخدم "${selectedUserForRecharge.full_name}" (${selectedUserForRecharge.email || selectedUserForRecharge.id})`,
                status: "success",
                user_id: currentAdmin?.uid || "admin",
                user_name: currentAdmin?.displayName || "مسؤول المنصة",
                user_email: currentAdmin?.email || "",
                user_role: logRole,
                target_user_id: selectedUserForRecharge.id,
                target_user_name: selectedUserForRecharge.full_name,
                amount: Number(rechargeAmount),
                metadata: {
                    user_id: selectedUserForRecharge.id,
                    user_role: selectedUserForRecharge.role,
                    amount_added: Number(rechargeAmount),
                }
            }).catch(() => {})

            setSelectedUserForRecharge(null)
            setRechargeAmount("")
        } catch (error) {
            console.error("Recharge error:", error)
            toast.error("حدث خطأ أثناء زيادة الرصيد")
        } finally {
            setIsRecharging(false)
        }
    }

    const handleManualWithdraw = async () => {
        if (!selectedUserForWithdraw || !withdrawAmount || Number(withdrawAmount) <= 0) return

        setIsWithdrawing(true)
        try {
            const currentBalance = selectedUserForWithdraw.wallet_balance || 0

            if (Number(withdrawAmount) > currentBalance) {
                toast.error("المبلغ المطلوب أكبر من الرصيد الحالي")
                setIsWithdrawing(false)
                return
            }

            const res = await fetch("/api/admin/wallet/adjust", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    targetUserId: selectedUserForWithdraw.id,
                    amount: Number(withdrawAmount),
                    type: "withdraw",
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "فشل تعديل الرصيد")

            setUsers(users.map(u =>
                u.id === selectedUserForWithdraw.id
                    ? { ...u, wallet_balance: (u.wallet_balance || 0) - Number(withdrawAmount) }
                    : u
            ))

            toast.success(`تم سحب ${withdrawAmount} ج.م من محفظة ${selectedUserForWithdraw.full_name}`)

            // Log activity
            const currentAdmin = auth.currentUser;
            logActivity({
                action: "admin_manual_deduct",
                category: "financial",
                title: "خصم رصيد يدوي بواسطة الإدارة",
                description: `قام ${roleLabel} بخصم مبلغ ${withdrawAmount} ج.م من محفظة المستخدم "${selectedUserForWithdraw.full_name}" (${selectedUserForWithdraw.email || selectedUserForWithdraw.id})`,
                status: "success",
                user_id: currentAdmin?.uid || "admin",
                user_name: currentAdmin?.displayName || "مسؤول المنصة",
                user_email: currentAdmin?.email || "",
                user_role: logRole,
                target_user_id: selectedUserForWithdraw.id,
                target_user_name: selectedUserForWithdraw.full_name,
                amount: -Number(withdrawAmount),
                metadata: {
                    user_id: selectedUserForWithdraw.id,
                    user_role: selectedUserForWithdraw.role,
                    amount_deducted: Number(withdrawAmount),
                }
            }).catch(() => {})

            setSelectedUserForWithdraw(null)
            setWithdrawAmount("")
        } catch (error) {
            console.error("Withdraw error:", error)
            toast.error("حدث خطأ أثناء سحب الرصيد")
        } finally {
            setIsWithdrawing(false)
        }
    }

    const handleUpdateStatus = async (userId: string, newStatus: string) => {
        try {
            const targetUser = users.find(u => u.id === userId);
            const res = await fetch("/api/admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId,
                    action: "update_status",
                    status: newStatus,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || "فشل تحديث الحالة");
            }

            setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u))
            toast.success(newStatus === 'approved' ? "تم تفعيل الحساب بنجاح" : "تم رفض الحساب")

            // Log activity
            const currentAdmin = auth.currentUser;
            logActivity({
                action: "user_status_changed",
                category: "admin_action",
                title: newStatus === "approved" ? "تفعيل حساب مستخدم" : "رفض / تعليق حساب مستخدم",
                description: `قام ${roleLabel} بـ (${newStatus === "approved" ? "تفعيل واعتماد" : "رفض"}) حساب المستخدم "${targetUser?.full_name || userId}"`,
                status: "success",
                user_id: currentAdmin?.uid || "admin",
                user_name: currentAdmin?.displayName || "مسؤول المنصة",
                user_email: currentAdmin?.email || "",
                user_role: logRole,
                target_user_id: userId,
                target_user_name: targetUser?.full_name,
                metadata: {
                    user_id: userId,
                    user_role: targetUser?.role,
                    new_status: newStatus,
                }
            }).catch(() => {})
        } catch (error: any) {
            console.error("Update status error:", error)
            toast.error(error.message || "حدث خطأ أثناء تحديث الحالة")
        }
    }

    const handleResetDevices = async (userId: string) => {
        try {
            const res = await fetch("/api/admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId,
                    action: "reset_devices",
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || "فشل تصفير الأجهزة");
            }

            setUsers(users.map(u => u.id === userId ? { ...u, active_devices: [] } : u))
            toast.success("تم تصفير الأجهزة المسجلة بنجاح")
        } catch (error: any) {
            console.error("Reset devices error:", error)
            toast.error(error.message || "حدث خطأ أثناء تصفير الأجهزة")
        }
    }

    // Verify / auto-report go through the API (direct profile writes are admin-only in Firestore rules)
    const postUserAction = async (body: Record<string, unknown>) => {
        const res = await fetch("/api/admin/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
            throw new Error(data.error || "فشل تنفيذ الإجراء")
        }
        return data
    }

    const handleToggleVerify = async (userId: string, currentStatus: boolean) => {
        try {
            await postUserAction({ userId, action: "set_verified", value: !currentStatus })
            setUsers(users.map(u => u.id === userId ? { ...u, is_verified: !currentStatus } : u))
            toast.success(!currentStatus ? "تم توثيق المدرس بنجاح" : "تم إلغاء توثيق المدرس")
        } catch (error) {
            console.error("Toggle verify error:", error)
            toast.error("حدث خطأ أثناء تحديث حالة التوثيق")
        }
    }

    const handleToggleAutoReport = async (userId: string, currentStatus: boolean) => {
        try {
            await postUserAction({ userId, action: "set_auto_report", value: !currentStatus })
            setUsers(users.map(u => u.id === userId ? { ...u, auto_report_unlocked: !currentStatus } : u))
            toast.success(!currentStatus ? "تم تفعيل الجدولة التلقائية للمدرس بنجاح" : "تم قفل الجدولة التلقائية للمدرس")
        } catch (error) {
            console.error("Toggle auto report error:", error)
            toast.error("حدث خطأ أثناء تحديث حالة الجدولة التلقائية")
        }
    }

    const handleConfirmRoleChange = async () => {
        if (!pendingRoleChange) return
        const { user: target, to } = pendingRoleChange
        setIsChangingRole(true)
        try {
            const data = await postUserAction({ userId: target.id, action: "set_role", role: to })
            setUsers(prev => prev.map(u => u.id === target.id
                ? { ...u, role: to, ...(data?.status ? { status: data.status } : {}) }
                : u))
            toast.success(`تم تغيير دور ${target.full_name || target.email || ""} إلى ${getRoleLabel(to)}`)
            setPendingRoleChange(null)
        } catch (error: any) {
            console.error("Change role error:", error)
            toast.error(error.message || "حدث خطأ أثناء تغيير الدور")
        } finally {
            setIsChangingRole(false)
        }
    }

    /**
     * Which actions the current role may take on a given row.
     * Non-admin staff never act on admin / staff accounts.
     */
    const getRowActions = (
        user: any,
        opts: { approve: boolean; reject: boolean }
    ) => {
        const isProtectedRow = !isAdmin && isBackofficeRole(user.role)
        const allowStatus = canManageStatus && !isProtectedRow
        const allowWallet = canAdjustWallet && !isProtectedRow
        const allowVerify = canVerify && !isProtectedRow
        return {
            onApprove: allowStatus && opts.approve ? () => handleUpdateStatus(user.id, 'approved') : undefined,
            onReject: allowStatus && opts.reject ? () => handleUpdateStatus(user.id, 'rejected') : undefined,
            onResetDevices: allowStatus ? () => handleResetDevices(user.id) : undefined,
            onRecharge: allowWallet ? (u: any) => setSelectedUserForRecharge(u) : undefined,
            onWithdraw: allowWallet ? (u: any) => setSelectedUserForWithdraw(u) : undefined,
            onToggleVerify: allowVerify ? handleToggleVerify : undefined,
            onToggleAutoReport: allowVerify ? handleToggleAutoReport : undefined,
            showWallet: canViewWallet,
            showContact: canViewContact,
            // Admin only, never on your own account
            onChangeRole: canManageRoles && user.id !== auth.currentUser?.uid
                ? (u: any, to: UserRole) => setPendingRoleChange({ user: u, to })
                : undefined,
        }
    }

    const filteredUsers = users.filter(u =>
        (roleFilter === "all" || (u.role || "student") === roleFilter) && (
            u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.phone?.includes(searchTerm)
        )
    )

    const PendingUsers = filteredUsers.filter(u => u.status === 'pending' || !u.status)
    const ApprovedUsers = filteredUsers.filter(u => u.status === 'approved')
    const Instructors = filteredUsers.filter(u => u.role === 'instructor')

    if (loading) {
        return <TablePageSkeleton rowCount={10} />
    }

    return (
        <div className="space-y-8 font-arabic">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">إدارة المستخدمين</h1>
                    <p className="text-muted-foreground italic">مراجعة وتفعيل حسابات الطلاب والمعلمين</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                        <SelectTrigger className="w-full sm:w-44">
                            <SelectValue placeholder="كل الأدوار" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">كل الأدوار</SelectItem>
                            {ALL_ROLES.map((r) => (
                                <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="relative w-full md:w-64">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="بحث بالاسم أو الإيميل..."
                            className="pr-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="بانتظار المراجعة" value={PendingUsers.length} icon={Users} color="text-orange-500" />
                <StatCard title="المعلمون" value={Instructors.length} icon={ShieldCheck} color="text-blue-500" />
                <StatCard title="إجمالي الطلاب" value={filteredUsers.filter(u => u.role === 'student').length} icon={GraduationCap} color="text-green-500" />
            </div>

            <Tabs defaultValue="pending" className="w-full">
                <TabsList className="grid w-full md:w-[600px] grid-cols-3">
                    <TabsTrigger value="pending" className="gap-2">
                        بانتظار المراجعة ({PendingUsers.length})
                    </TabsTrigger>
                    <TabsTrigger value="approved" className="gap-2">
                        الحسابات النشطة ({ApprovedUsers.length})
                    </TabsTrigger>
                    <TabsTrigger value="all" className="gap-2">
                        الكل ({filteredUsers.length})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="pt-6">
                    <div className="grid gap-6">
                        {PendingUsers.length > 0 ? (
                            PendingUsers.map((user) => (
                                    <UserCard
                                        key={user.id}
                                        user={user}
                                        {...getRowActions(user, { approve: true, reject: true })}
                                    />
                            ))
                        ) : (
                            <div className="text-center py-12 border-2 border-dashed rounded-2xl text-muted-foreground">
                                لا يوجد حسابات بانتظار المراجعة حالياً
                            </div>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="approved" className="pt-6">
                    <div className="grid gap-6">
                        {ApprovedUsers.map((user) => (
                            <UserCard
                                key={user.id}
                                user={user}
                                {...getRowActions(user, { approve: false, reject: true })}
                            />
                        ))}
                    </div>
                </TabsContent>

                        <TabsContent value="all" className="pt-6">
                            <div className="grid gap-6">
                                {filteredUsers.map((user) => (
                                    <UserCard
                                        key={user.id}
                                        user={user}
                                        {...getRowActions(user, {
                                            approve: user.status !== 'approved',
                                            reject: user.status !== 'rejected',
                                        })}
                                    />
                                ))}
                            </div>
                        </TabsContent>
            </Tabs>

            {/* Recharge Dialog */}
            <Dialog open={!!selectedUserForRecharge} onOpenChange={(open) => !open && setSelectedUserForRecharge(null)}>
                <DialogContent className="sm:max-w-[425px] font-arabic">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">شحن رصيد يدوي</DialogTitle>
                        <DialogDescription>
                            إضافة مبلغ مالي لمحفظة <span className="font-bold text-primary">{selectedUserForRecharge?.full_name}</span> مباشرة.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="amount" className="text-right">المبلغ (ج.م)</Label>
                            <Input
                                id="amount"
                                type="number"
                                placeholder="مثال: 500"
                                value={rechargeAmount}
                                onChange={(e) => setRechargeAmount(e.target.value)}
                                className="h-12 text-lg font-bold"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedUserForRecharge(null)}>إلغاء</Button>
                        <Button
                            onClick={handleManualRecharge}
                            disabled={isRecharging || !rechargeAmount}
                            className="font-bold"
                        >
                            {isRecharging ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Wallet className="h-4 w-4 ml-2" />}
                            تأكيد الإضافة
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Change Role Confirm Dialog (admin only) */}
            <Dialog open={!!pendingRoleChange} onOpenChange={(open) => !open && !isChangingRole && setPendingRoleChange(null)}>
                <DialogContent className="sm:max-w-[440px] font-arabic">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">تأكيد تغيير الدور</DialogTitle>
                        <DialogDescription>
                            {pendingRoleChange &&
                                `تغيير دور ${pendingRoleChange.user.full_name || pendingRoleChange.user.email || ""} من ${getRoleLabel(pendingRoleChange.user.role)} إلى ${getRoleLabel(pendingRoleChange.to)}؟`}
                            <br />
                            <span className="text-xs">سيتم تسجيل خروج المستخدم لتطبيق الصلاحيات الجديدة عند دخوله التالي.</span>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPendingRoleChange(null)} disabled={isChangingRole}>إلغاء</Button>
                        <Button onClick={handleConfirmRoleChange} disabled={isChangingRole} className="font-bold">
                            {isChangingRole && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                            تأكيد التغيير
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Withdraw Dialog */}
            <Dialog open={!!selectedUserForWithdraw} onOpenChange={(open) => !open && setSelectedUserForWithdraw(null)}>
                <DialogContent className="sm:max-w-[425px] font-arabic">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">سحب رصيد يدوي</DialogTitle>
                        <DialogDescription>
                            سحب مبلغ مالي من محفظة <span className="font-bold text-primary">{selectedUserForWithdraw?.full_name}</span> مباشرة.
                            <br />
                            <span className="text-xs text-muted-foreground">الرصيد الحالي: {selectedUserForWithdraw?.wallet_balance || 0} ج.م</span>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="withdrawAmount" className="text-right">المبلغ المراد سحبه (ج.م)</Label>
                            <Input
                                id="withdrawAmount"
                                type="number"
                                placeholder="مثال: 100"
                                value={withdrawAmount}
                                onChange={(e) => setWithdrawAmount(e.target.value)}
                                className="h-12 text-lg font-bold"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedUserForWithdraw(null)}>إلغاء</Button>
                        <Button
                            onClick={handleManualWithdraw}
                            disabled={isWithdrawing || !withdrawAmount}
                            variant="destructive"
                            className="font-bold"
                        >
                            {isWithdrawing ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <XCircle className="h-4 w-4 ml-2" />}
                            تأكيد السحب
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function StatCard({ title, value, icon: Icon, color }: any) {
    return (
        <Card>
            <CardContent className="pt-6 flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-muted-foreground">{title}</p>
                    <p className={`text-3xl font-bold ${color}`}>{value}</p>
                </div>
                <div className={`p-3 rounded-full bg-muted`}>
                    <Icon className={`h-6 w-6 ${color}`} />
                </div>
            </CardContent>
        </Card>
    )
}

function UserCard({ user, onApprove, onReject, onRecharge, onWithdraw, onResetDevices, onToggleVerify, onToggleAutoReport, onChangeRole, showWallet, showContact }: any) {
    const avatarUrl = user.photoURL || user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.full_name || user.id}`

    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex items-start gap-4">
                        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 relative overflow-hidden border-2 border-primary/10">
                            <img src={avatarUrl} className="w-full h-full object-cover" alt="User Avatar" />
                            {user.status === 'approved' && (
                                <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5 shadow-sm z-10">
                                    <CheckCircle2 className="h-5 w-5 text-green-500 fill-green-50" />
                                </div>
                            )}
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <h3 className="text-xl font-bold">{user.full_name}</h3>
                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-primary/5 text-primary rounded-md border border-primary/10">
                                    <Fingerprint className="h-3 w-3" />
                                    <span className="text-[10px] font-mono font-bold tracking-tighter">{user.student_id || "بدون كود"}</span>
                                </div>
                                <Badge variant={user.role === 'instructor' ? 'default' : 'secondary'}>
                                    {getRoleLabel(user.role)}
                                </Badge>
                                <Badge variant="outline" className={
                                    user.status === 'approved' ? "text-green-600 border-green-200 bg-green-50" :
                                        user.status === 'rejected' ? "text-red-600 border-red-200 bg-red-50" :
                                            "text-orange-600 border-orange-200 bg-orange-50"
                                }>
                                    {user.status === 'approved' ? 'نشط' :
                                        user.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
                                </Badge>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-muted-foreground">
                                {showContact && (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <Mail className="h-3.5 w-3.5" />
                                            {user.email}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Phone className="h-3.5 w-3.5" />
                                            {user.phone}
                                        </div>
                                    </>
                                )}
                                {user.role === 'student' && (
                                    <>
                                        {showWallet && (
                                            <div className="flex items-center gap-2 text-primary font-bold">
                                                <Wallet className="h-3.5 w-3.5" />
                                                المحفظة: {user.wallet_balance || 0} ج.م
                                            </div>
                                        )}
                                        {showContact && (
                                            <div className="flex items-center gap-2">
                                                <Users className="h-3.5 w-3.5" />
                                                ولي الأمر: {user.parent_phone}
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2">
                                            <School className="h-3.5 w-3.5" />
                                            {user.grade_level}
                                        </div>
                                    </>
                                )}
                                {user.role === 'instructor' && (
                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex items-center gap-2">
                                            <User className="h-3.5 w-3.5" />
                                            التخصص: {user.specialty}
                                            {user.is_verified && <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 text-[10px]">موثق</Badge>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-3.5 w-3.5 text-purple-500" />
                                            <span>الجدولة التلقائية:</span>
                                            {user.auto_report_unlocked ? (
                                                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-[10px] font-bold">نشطة</Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 text-[10px] font-bold">مغلقة</Badge>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0 sm:min-w-[140px]">
                        {onChangeRole && (
                            <Select
                                value={user.role || "student"}
                                onValueChange={(value) => {
                                    if (value !== (user.role || "student")) onChangeRole(user, value)
                                }}
                            >
                                <SelectTrigger className="w-full h-9" aria-label="تغيير الدور">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {ALL_ROLES.map((r) => (
                                        <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        {user.role === 'instructor' && (
                            <>
                                {onToggleVerify && (
                                    <Button
                                        variant="outline"
                                        className={`w-full gap-2 h-9 font-bold ${user.is_verified ? 'text-amber-600 border-amber-200 bg-amber-50' : 'text-blue-600 border-blue-200 bg-blue-50'}`}
                                        size="sm"
                                        onClick={() => onToggleVerify(user.id, !!user.is_verified)}
                                    >
                                        <ShieldCheck className="h-4 w-4" />
                                        {user.is_verified ? 'إلغاء التوثيق' : 'توثيق المدرس'}
                                    </Button>
                                )}
                                {onToggleAutoReport && (
                                    <Button
                                        variant="outline"
                                        className={`w-full gap-2 h-9 font-bold ${user.auto_report_unlocked ? 'text-rose-600 border-rose-200 bg-rose-50 hover:bg-rose-100 hover:text-rose-700' : 'text-purple-600 border-purple-200 bg-purple-50 hover:bg-purple-100 hover:text-purple-700'}`}
                                        size="sm"
                                        onClick={() => onToggleAutoReport(user.id, !!user.auto_report_unlocked)}
                                    >
                                        <Calendar className="h-4 w-4" />
                                        {user.auto_report_unlocked ? 'قفل الجدولة' : 'تفعيل الجدولة'}
                                    </Button>
                                )}
                            </>
                        )}
                        {onApprove && (
                            <Button className="w-full gap-2 bg-green-600 hover:bg-green-700 h-9" size="sm" onClick={onApprove}>
                                <CheckCircle2 className="h-4 w-4" />
                                تفعيل الحساب
                            </Button>
                        )}
                        {onReject && (
                            <Button variant="outline" className="w-full gap-2 text-red-600 hover:bg-red-50 h-9" size="sm" onClick={onReject}>
                                <XCircle className="h-4 w-4" />
                                {user.status === 'approved' ? 'حظر الحساب' : 'رفض الطلب'}
                            </Button>
                        )}
                        {user.role === 'student' && (
                            <>
                                {onRecharge && (
                                    <Button
                                        variant="outline"
                                        className="w-full gap-2 border-primary/20 text-primary hover:bg-primary/5 h-9"
                                        size="sm"
                                        onClick={() => onRecharge(user)}
                                    >
                                        <PlusCircle className="h-4 w-4" />
                                        شحن المحفظة
                                    </Button>
                                )}
                                {onResetDevices && user.active_devices && user.active_devices.length > 0 && (
                                    <Button
                                        variant="outline"
                                        className="w-full gap-2 border-blue-200 text-blue-600 hover:bg-blue-50 h-9"
                                        size="sm"
                                        onClick={onResetDevices}
                                    >
                                        <Fingerprint className="h-4 w-4" />
                                        تصفير الأجهزة ({user.active_devices.length})
                                    </Button>
                                )}
                            </>
                        )}
                        {user.role === 'student' && onWithdraw && user.status === 'approved' && (
                            <Button
                                variant="outline"
                                className="w-full gap-2 border-red-200 text-red-600 hover:bg-red-50 h-9"
                                size="sm"
                                onClick={() => onWithdraw(user)}
                            >
                                <XCircle className="h-4 w-4" />
                                سحب من المحفظة
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
