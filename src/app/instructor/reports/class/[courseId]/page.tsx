"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { auth, db } from "@/lib/firebase/config"
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    Users,
    BookOpen,
    Calendar,
    Award,
    CheckCircle2,
    ArrowRight,
    Printer,
    FileText,
    TrendingUp,
    Clock,
    UserCheck
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { AnalyticsSkeleton } from "@/components/skeletons"

export default function ClassReportPage() {
    const { courseId } = useParams()
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(true)
    const [instructor, setInstructor] = useState<any>(null)
    const [course, setCourse] = useState<any>(null)
    const [students, setStudents] = useState<any[]>([])

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setInstructor(user)
                fetchClassData(user.uid)
            } else {
                router.push("/login")
            }
        })
        return () => unsubscribe()
    }, [courseId])

    async function fetchClassData(instructorId: string) {
        setIsLoading(true)
        try {
            // 1. Fetch Course Info
            const courseSnap = await getDoc(doc(db, "courses", courseId as string))
            if (courseSnap.exists()) {
                const cData = courseSnap.data()
                if (cData.instructor_id !== instructorId) {
                    toast.error("عذراً، لا تملك الصلاحية لعرض تقارير هذا الكورس")
                    router.push("/instructor/reports")
                    return
                }
                setCourse({ id: courseSnap.id, ...cData })
            } else {
                toast.error("الكورس غير موجود")
                router.push("/instructor/reports")
                return
            }

            // 2. Fetch Enrollments & students via secure server API
            const res = await fetch(`/api/instructor/reports/students?courseId=${courseId}`)
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}))
                throw new Error(errData.error || "فشل في تحميل بيانات تقرير الفصل")
            }
            const data = await res.json()
            const studentList = (data.students || []).map((s: any) => {
                const avgScore = s.submissions && s.submissions.length > 0
                    ? Math.round(s.submissions.reduce((acc: number, curr: any) => acc + (curr.score || 0), 0) / s.submissions.length)
                    : 0
                return {
                    id: s.id,
                    name: s.name,
                    email: s.email,
                    avatar: s.avatar,
                    phone: s.phone,
                    progress: s.progress,
                    completedLessons: s.completedLessons,
                    totalLessons: s.totalLessons,
                    lastAccessed: s.lastAccessed,
                    averageScore: avgScore,
                    submissionsCount: s.submissions ? s.submissions.length : 0
                }
            })

            setStudents(studentList)
        } catch (error: any) {
            console.error("Error fetching class report data:", error)
            toast.error(error.message || "فشل في تحميل بيانات تقرير الفصل")
        } finally {
            setIsLoading(false)
        }
    }

    if (isLoading) {
        return <AnalyticsSkeleton />
    }

    // Calculations
    const totalStudents = students.length
    const classAvgProgress = totalStudents > 0
        ? Math.round(students.reduce((acc, s) => acc + s.progress, 0) / totalStudents)
        : 0
    const classAvgScore = totalStudents > 0
        ? Math.round(students.reduce((acc, s) => acc + s.averageScore, 0) / totalStudents)
        : 0
    const totalLessons = course?.modules?.reduce((acc: number, mod: any) => acc + (mod.lessons?.length || 0), 0) || 0

    const handlePrintPDF = () => {
        const windowUrl = 'about:blank';
        const uniqueName = new Date().getTime();
        const windowName = 'ClassReport_' + uniqueName;
        const printWindow = window.open(windowUrl, windowName, 'left=50000,top=50000,width=0,height=0');

        if (!printWindow) {
            alert("يرجى تفعيل السماح بالنوافذ المنبثقة (Popups) لتصدير تقرير الفصل كـ PDF");
            return;
        }

        const dateStr = new Date().toLocaleDateString("ar-EG", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        });

        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
                <head>
                    <meta charset="utf-8">
                    <title>تقرير الفصل الدراسي - ${course?.title || "كورس"}</title>
                    <style>
                        @page { size: A4 portrait; margin: 12mm 15mm; }
                        * { box-sizing: border-box; }
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                            direction: rtl;
                            background: #ffffff;
                            color: #18181b;
                            margin: 0;
                            padding: 20px;
                            font-size: 13px;
                            line-height: 1.5;
                        }
                        .report-card {
                            border: 2px solid #e4e4e7;
                            border-radius: 16px;
                            padding: 24px;
                            max-width: 900px;
                            margin: 0 auto;
                        }
                        .header {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            border-bottom: 2px solid #f4f4f5;
                            padding-bottom: 18px;
                            margin-bottom: 20px;
                        }
                        .header h1 {
                            margin: 0;
                            font-size: 22px;
                            color: #0f172a;
                            font-weight: 900;
                        }
                        .header p {
                            margin: 4px 0 0;
                            color: #64748b;
                            font-size: 12px;
                            font-weight: 600;
                        }
                        .meta-box {
                            background: #f8fafc;
                            border: 1px solid #e2e8f0;
                            border-radius: 12px;
                            padding: 14px 18px;
                            margin-bottom: 22px;
                            display: grid;
                            grid-template-columns: repeat(2, 1fr);
                            gap: 12px;
                        }
                        .meta-item {
                            font-size: 12px;
                        }
                        .meta-item strong {
                            color: #0f172a;
                        }
                        .kpi-grid {
                            display: grid;
                            grid-template-columns: repeat(3, 1fr);
                            gap: 12px;
                            margin-bottom: 24px;
                        }
                        .kpi-box {
                            border: 1px solid #e2e8f0;
                            background: #ffffff;
                            border-radius: 12px;
                            padding: 14px;
                            text-align: center;
                        }
                        .kpi-box .val {
                            font-size: 22px;
                            font-weight: 900;
                            color: #0f172a;
                            margin-bottom: 2px;
                        }
                        .kpi-box .lbl {
                            font-size: 11px;
                            font-weight: 700;
                            color: #64748b;
                            text-transform: uppercase;
                        }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-top: 10px;
                            font-size: 12px;
                        }
                        th {
                            background: #f1f5f9;
                            color: #334155;
                            font-weight: 800;
                            text-align: right;
                            padding: 10px 12px;
                            border-bottom: 2px solid #cbd5e1;
                        }
                        td {
                            padding: 9px 12px;
                            border-bottom: 1px solid #e2e8f0;
                            color: #1e293b;
                        }
                        tr:nth-child(even) td {
                            background: #fafafa;
                        }
                        .badge {
                            display: inline-block;
                            padding: 3px 8px;
                            border-radius: 6px;
                            font-size: 10px;
                            font-weight: 700;
                        }
                        .badge-high { background: #dcfce7; color: #15803d; }
                        .badge-med { background: #fef9c3; color: #854d0e; }
                        .badge-low { background: #fee2e2; color: #991b1b; }
                        .footer {
                            margin-top: 35px;
                            padding-top: 16px;
                            border-top: 1px dashed #cbd5e1;
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-end;
                            font-size: 12px;
                        }
                        .stamp-block {
                            text-align: center;
                            min-width: 160px;
                        }
                        .stamp-box {
                            height: 60px;
                            border-bottom: 1px solid #94a3b8;
                            margin-bottom: 6px;
                        }
                    </style>
                </head>
                <body>
                    <div class="report-card">
                        <div class="header">
                            <div>
                                <h1>أكاديمية المنارة التعليمية</h1>
                                <p>تقرير أداء ومتابعة الصف الدراسي الشامل</p>
                            </div>
                            <div style="text-align: left; font-size: 11px; color: #64748b;">
                                <div><strong>تاريخ التقرير:</strong> ${dateStr}</div>
                                <div><strong>المحاضر:</strong> ${course?.instructor_name || "مدرس المادة"}</div>
                            </div>
                        </div>

                        <div class="meta-box">
                            <div class="meta-item"><strong>المقرر التعليمي:</strong> ${course?.title || "الكورس"}</div>
                            <div class="meta-item"><strong>إجمالي عدد الدروس:</strong> ${totalLessons} درس</div>
                            <div class="meta-item"><strong>إجمالي الطلاب المسجلين:</strong> ${totalStudents} طالب</div>
                            <div class="meta-item"><strong>الصف الدراسي / الفئة:</strong> ${course?.grade_level || "عام"}</div>
                        </div>

                        <div class="kpi-grid">
                            <div class="kpi-box">
                                <div class="val">${totalStudents}</div>
                                <div class="lbl">إجمالي طلاب الصف</div>
                            </div>
                            <div class="kpi-box">
                                <div class="val" style="color: #ea580c;">${classAvgProgress}%</div>
                                <div class="lbl">متوسط إنجاز الفصل</div>
                            </div>
                            <div class="kpi-box">
                                <div class="val" style="color: #16a34a;">${classAvgScore}%</div>
                                <div class="lbl">متوسط درجات الطلاب</div>
                            </div>
                        </div>

                        <h3 style="margin: 18px 0 8px; font-size: 14px; font-weight: 800; color: #0f172a;">جدول تفصيلي بمستوى جميع الطلاب (${totalStudents} طالب)</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>اسم الطالب</th>
                                    <th>رقم الهاتف</th>
                                    <th>الدروس المكتملة</th>
                                    <th>نسبة التقدم</th>
                                    <th>متوسط الدرجات</th>
                                    <th>التقييم العام</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${students.length === 0 ? `
                                    <tr>
                                        <td colspan="7" style="text-align: center; padding: 25px; color: #64748b;">لا يوجد طلاب مسجلين في هذا المقرر حتى الآن.</td>
                                    </tr>
                                ` : students.map((s, idx) => {
                                    const evalClass = s.averageScore >= 80 ? 'badge-high' : s.averageScore >= 50 ? 'badge-med' : 'badge-low';
                                    const evalText = s.averageScore >= 85 ? 'ممتاز ⭐' : s.averageScore >= 70 ? 'جيد جداً' : s.averageScore >= 50 ? 'متوسط' : 'يحتاج متابعة ⚠️';
                                    return `
                                        <tr>
                                            <td style="color: #64748b;">${idx + 1}</td>
                                            <td style="font-weight: 800;">${s.name}</td>
                                            <td style="direction: ltr; text-align: right; color: #475569;">${s.phone || 'غير مسجل'}</td>
                                            <td>${s.completedLessons} من ${s.totalLessons}</td>
                                            <td><strong>${s.progress}%</strong></td>
                                            <td><span class="badge ${evalClass}">${s.averageScore}%</span></td>
                                            <td><span class="badge ${evalClass}">${evalText}</span></td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>

                        <div class="footer">
                            <div>
                                <p style="margin: 0; font-weight: 700; color: #0f172a;">أكاديمية المنارة للتعليم الإلكتروني الذكي © 2026</p>
                                <p style="margin: 3px 0 0; color: #64748b; font-size: 11px;">مستند رسمي معتمد صادر من المنصة لمتابعة الصف الدراسي.</p>
                            </div>
                            <div class="stamp-block">
                                <div class="stamp-box"></div>
                                <div>توقيع واعتماد معلم المادة</div>
                            </div>
                            <div class="stamp-block">
                                <div class="stamp-box"></div>
                                <div>ختم إدارة الأكاديمية</div>
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
    };

    return (
        <div className="container py-8 space-y-8 font-arabic animate-in fade-in duration-500 pb-20 select-none">
            {/* Header / Top Nav */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b pb-6 print:hidden">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => router.back()} className="rounded-full h-11 w-11 shadow-sm">
                        <ArrowRight className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
                            <BookOpen className="h-7 w-7 text-primary" />
                            تقرير كامل الصف الدراسي
                        </h1>
                        <p className="text-muted-foreground mt-1 text-sm font-medium">عرض أداء ومقارنات جميع طلاب كورس: <span className="font-bold text-zinc-800">{course?.title}</span></p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="lg" className="rounded-xl font-bold gap-2 h-11 border-zinc-200" onClick={handlePrintPDF}>
                        <Printer className="h-4 w-4" />
                        طباعة / تصدير PDF
                    </Button>
                </div>
            </div>

            {/* PRINT-ONLY HEADER */}
            <div className="hidden print:flex flex-col gap-4 border-b pb-6 text-right mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-primary">أكاديمية المنارة التعليمية</h1>
                        <p className="text-sm font-bold text-zinc-500 mt-1">لوحة تقرير ومقارنة مستوى الفصل الدراسي</p>
                    </div>
                    <div className="text-left font-bold text-xs text-zinc-400">
                        <p>التاريخ: {new Date().toLocaleDateString("ar-EG")}</p>
                        <p>بواسطة المدرس: {course?.instructor_name}</p>
                    </div>
                </div>
                <div className="bg-zinc-50 p-4 rounded-xl border flex flex-col gap-1.5 mt-2">
                    <h2 className="text-xl font-bold">المقرر: {course?.title}</h2>
                    <p className="text-xs font-bold text-zinc-500">مجموع الطلاب المسجلين بالتقرير: {totalStudents} طالب</p>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-2 shadow-sm bg-zinc-50/50 hover:bg-zinc-100/50 transition-colors relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                    <CardContent className="p-6 flex flex-col items-center text-center gap-2">
                        <div className="p-3 rounded-xl bg-blue-100 text-blue-600">
                            <Users className="h-6 w-6" />
                        </div>
                        <p className="text-3xl font-black tabular-nums">{totalStudents}</p>
                        <p className="text-xs font-bold text-muted-foreground uppercase">إجمالي طلاب الصف</p>
                    </CardContent>
                </Card>

                <Card className="border-2 shadow-sm bg-zinc-50/50 hover:bg-zinc-100/50 transition-colors relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                    <CardContent className="p-6 flex flex-col items-center text-center gap-2">
                        <div className="p-3 rounded-xl bg-orange-100 text-orange-600">
                            <TrendingUp className="h-6 w-6" />
                        </div>
                        <p className="text-3xl font-black tabular-nums">{classAvgProgress}%</p>
                        <p className="text-xs font-bold text-muted-foreground uppercase">متوسط تقدم الفصل الدراسي</p>
                    </CardContent>
                </Card>

                <Card className="border-2 shadow-sm bg-zinc-50/50 hover:bg-zinc-100/50 transition-colors relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                    <CardContent className="p-6 flex flex-col items-center text-center gap-2">
                        <div className="p-3 rounded-xl bg-green-100 text-green-700">
                            <Award className="h-6 w-6" />
                        </div>
                        <p className="text-3xl font-black tabular-nums">{classAvgScore}%</p>
                        <p className="text-xs font-bold text-muted-foreground uppercase">متوسط درجات الطلاب</p>
                    </CardContent>
                </Card>
            </div>

            {/* Comparison Table */}
            <Card className="border-2 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/10 pb-4 border-b print:hidden">
                    <CardTitle className="text-lg font-bold">جدول المقارنة بين الطلاب</CardTitle>
                    <CardDescription className="text-xs font-bold text-muted-foreground">تفصيل مستويات جميع الطلاب المسجلين بالكورس ومعدلاتهم التعليمية.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table className="font-arabic min-w-full">
                            <TableHeader className="bg-zinc-50 border-b">
                                <TableRow>
                                    <TableHead className="text-right font-black text-zinc-700">اسم الطالب</TableHead>
                                    <TableHead className="text-right font-black text-zinc-700">رقم الهاتف</TableHead>
                                    <TableHead className="text-right font-black text-zinc-700">المحاضرات المكتملة</TableHead>
                                    <TableHead className="text-right font-black text-zinc-700">نسبة التقدم</TableHead>
                                    <TableHead className="text-right font-black text-zinc-700">متوسط الدرجات</TableHead>
                                    <TableHead className="text-right font-black text-zinc-700">آخر دخول للمنصة</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {students.map((student) => (
                                    <TableRow key={student.id} className="hover:bg-zinc-50/50">
                                        <TableCell className="font-bold py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm overflow-hidden border">
                                                    {student.avatar ? (
                                                        <img src={student.avatar} className="w-full h-full object-cover" alt="" />
                                                    ) : (
                                                        student.name.charAt(0)
                                                    )}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span>{student.name}</span>
                                                    <span className="text-[10px] text-zinc-400 font-bold leading-none mt-0.5 print:hidden">{student.email}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs font-bold text-zinc-600 tabular-nums">{student.phone}</TableCell>
                                        <TableCell className="text-xs font-bold text-zinc-700">
                                            <span className="bg-zinc-100 px-2 py-1 rounded font-black tabular-nums">
                                                {student.completedLessons} / {student.totalLessons} محاضرة
                                            </span>
                                        </TableCell>
                                        <TableCell className="w-48 py-4">
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between text-[10px] font-black text-primary">
                                                    <span>تقدم الكورس</span>
                                                    <span>{student.progress}%</span>
                                                </div>
                                                <Progress value={student.progress} className="h-1.5 bg-zinc-100" />
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-4">
                                            <span className={`text-sm font-black px-3 py-1.5 rounded-xl ${student.averageScore >= 80 ? 'bg-green-100 text-green-700' : student.averageScore >= 50 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-600'}`}>
                                                {student.averageScore}%
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-xs font-bold text-muted-foreground">
                                            {student.lastAccessed ? (
                                                new Date(student.lastAccessed).toLocaleDateString("ar-EG")
                                            ) : (
                                                <span className="text-zinc-300 italic font-medium">لم يدخل بعد</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* CSS Print Styles */}
            <style jsx global>{`
                @media print {
                    body {
                        background-color: white !important;
                        color: black !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    .container {
                        max-width: 100% !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                    .hidden.print\\:flex {
                        display: flex !important;
                    }
                    table {
                        border-collapse: collapse !important;
                    }
                    th, td {
                        border: 1px solid #e2e8f0 !important;
                        padding: 12px 10px !important;
                    }
                }
            `}</style>
        </div>
    )
}
