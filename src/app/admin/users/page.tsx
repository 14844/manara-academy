"use client"

import { useState, useEffect } from "react"
import { db } from "@/lib/firebase/config"
import { collection, query, getDocs, doc, updateDoc, orderBy } from "firebase/firestore"
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
    PlusCircle
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
import { increment, runTransaction } from "firebase/firestore"

export default function AdminUsersPage() {
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
            const userRef = doc(db, "profiles", selectedUserForRecharge.id)
            await updateDoc(userRef, {
                wallet_balance: increment(Number(rechargeAmount)),
                updated_at: new Date().toISOString()
            })

            setUsers(users.map(u =>
                u.id === selectedUserForRecharge.id
                    ? { ...u, wallet_balance: (u.wallet_balance || 0) + Number(rechargeAmount) }
                    : u
            ))

            toast.success(`تم إضافة ${rechargeAmount} ج.م لمحفظة ${selectedUserForRecharge.full_name}`)
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
            const userRef = doc(db, "profiles", selectedUserForWithdraw.id)
            const currentBalance = selectedUserForWithdraw.wallet_balance || 0

            if (Number(withdrawAmount) > currentBalance) {
                toast.error("المبلغ المطلوب أكبر من الرصيد الحالي")
                setIsWithdrawing(false)
                return
            }

            await updateDoc(userRef, {
                wallet_balance: increment(-Number(withdrawAmount)),
                updated_at: new Date().toISOString()
            })

            setUsers(users.map(u =>
                u.id === selectedUserForWithdraw.id
                    ? { ...u, wallet_balance: (u.wallet_balance || 0) - Number(withdrawAmount) }
                    : u
            ))

            toast.success(`تم سحب ${withdrawAmount} ج.م من محفظة ${selectedUserForWithdraw.full_name}`)
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
            await updateDoc(doc(db, "profiles", userId), {
                status: newStatus,
                updated_at: new Date().toISOString()
            })
            setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u))
            toast.success(newStatus === 'approved' ? "تم تفعيل الحساب بنجاح" : "تم رفض الحساب")
        } catch (error) {
            console.error("Update status error:", error)
            toast.error("حدث خطأ أثناء تحديث الحالة")
        }
    }

    const filteredUsers = users.filter(u =>
        u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.phone?.includes(searchTerm)
    )

    const PendingUsers = filteredUsers.filter(u => u.status === 'pending' || !u.status)
    const ApprovedUsers = filteredUsers.filter(u => u.status === 'approved')
    const Instructors = filteredUsers.filter(u => u.role === 'instructor')

    if (loading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-8 font-arabic">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">إدارة المستخدمين</h1>
                    <p className="text-muted-foreground italic">مراجعة وتفعيل حسابات الطلاب والمعلمين</p>
                </div>
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
                                    onApprove={() => handleUpdateStatus(user.id, 'approved')}
                                    onReject={() => handleUpdateStatus(user.id, 'rejected')}
                                    onRecharge={(u: any) => setSelectedUserForRecharge(u)}
                                    onWithdraw={(u: any) => setSelectedUserForWithdraw(u)}
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
                                onReject={() => handleUpdateStatus(user.id, 'rejected')}
                                onRecharge={(u: any) => setSelectedUserForRecharge(u)}
                                onWithdraw={(u: any) => setSelectedUserForWithdraw(u)}
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
                                onApprove={user.status !== 'approved' ? () => handleUpdateStatus(user.id, 'approved') : undefined}
                                onReject={user.status !== 'rejected' ? () => handleUpdateStatus(user.id, 'rejected') : undefined}
                                onRecharge={(u: any) => setSelectedUserForRecharge(u)}
                                onWithdraw={(u: any) => setSelectedUserForWithdraw(u)}
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

function UserCard({ user, onApprove, onReject, onRecharge, onWithdraw }: any) {
    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex items-start gap-4">
                        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 relative">
                            {user.role === 'instructor' ? <ShieldCheck className="h-7 w-7" /> : <GraduationCap className="h-7 w-7" />}
                            {user.status === 'approved' && (
                                <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5 shadow-sm">
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
                                    {user.role === 'instructor' ? 'مدرس' : 'طالب'}
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
                                <div className="flex items-center gap-2">
                                    <Mail className="h-3.5 w-3.5" />
                                    {user.email}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Phone className="h-3.5 w-3.5" />
                                    {user.phone}
                                </div>
                                {user.role === 'student' && (
                                    <>
                                        <div className="flex items-center gap-2 text-primary font-bold">
                                            <Wallet className="h-3.5 w-3.5" />
                                            المحفظة: {user.wallet_balance || 0} ج.م
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Users className="h-3.5 w-3.5" />
                                            ولي الأمر: {user.parent_phone}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <School className="h-3.5 w-3.5" />
                                            {user.grade_level}
                                        </div>
                                    </>
                                )}
                                {user.role === 'instructor' && (
                                    <div className="flex items-center gap-2">
                                        <User className="h-3.5 w-3.5" />
                                        التخصص: {user.specialty}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0 sm:min-w-[140px]">
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
                        {user.role === 'student' && onRecharge && (
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
