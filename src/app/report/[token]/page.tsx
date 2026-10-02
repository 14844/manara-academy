"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { db } from "@/lib/firebase/config"
import { doc, getDoc } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
    GraduationCap,
    Award,
    CheckCircle2,
    Calendar,
    Clock,
    User,
    Printer,
    FileText,
    TrendingUp,
    AlertTriangle,
    CheckCircle,
    UserCircle,
    Activity,
    AlertOctagon,
    HeartHandshake
} from "lucide-react"

export default function ParentReportPublicPage() {
    const { token } = useParams()
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(true)
    const [report, setReport] = useState<any>(null)
    const [isExpired, setIsExpired] = useState(false)
    const printRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (token) {
            fetchReport(token as string)
        }
    }, [token])

    const handlePrint = () => {
        if (!report) return;

        const printWindow = window.open('about:blank', 'PrintReport', 'width=900,height=900');
        if (!printWindow) {
            alert("برجاء تفعيل السماح بالنوافذ المنبثقة (Popups) لتصدير التقرير كـ PDF");
            return;
        }

        printWindow.document.write(`
            <html>
                <head>
                    <title>تقرير متابعة دراسية - ${report.student_name}</title>
                    <style>
                        @page {
                            size: A4;
                            margin: 15mm;
                        }
                        body {
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                            direction: rtl;
                            padding: 30px;
                            background-color: white;
                            color: #1f2937;
                            line-height: 1.6;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        .report-container {
                            max-width: 800px;
                            margin: 0 auto;
                        }
                        .header {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            border-bottom: 2px solid #e5e7eb;
                            padding-bottom: 20px;
                            margin-bottom: 30px;
                        }
                        .title-section h1 {
                            font-size: 24px;
                            font-weight: 800;
                            color: #18181b;
                            margin: 0 0 5px 0;
                        }
                        .title-section p {
                            font-size: 13px;
                            color: #6b7280;
                            margin: 0;
                        }
                        .date-section {
                            font-size: 11px;
                            color: #6b7280;
                            text-align: left;
                        }
                        .date-section div {
                            margin-bottom: 3px;
                        }
                        .badge-role {
                            background-color: #f4f4f5;
                            color: #18181b;
                            padding: 4px 12px;
                            border-radius: 9999px;
                            font-size: 10px;
                            font-weight: 800;
                            display: inline-block;
                            margin-bottom: 8px;
                        }
                        .student-card {
                            display: flex;
                            align-items: center;
                            gap: 20px;
                            border: 1px solid #e5e7eb;
                            padding: 20px;
                            border-radius: 16px;
                            background-color: #f9fafb;
                            margin-bottom: 30px;
                        }
                        .avatar {
                            width: 60px;
                            height: 60px;
                            border-radius: 12px;
                            background-color: #e4e4e7;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-weight: bold;
                            font-size: 24px;
                            color: #18181b;
                            border: 1px solid #d4d4d8;
                            overflow: hidden;
                        }
                        .avatar img {
                            width: 100%;
                            height: 100%;
                            object-fit: cover;
                        }
                        .student-info h3 {
                            font-size: 18px;
                            font-weight: 800;
                            margin: 0 0 5px 0;
                        }
                        .student-info span {
                            font-size: 11px;
                            background-color: #e5e7eb;
                            padding: 2px 8px;
                            border-radius: 4px;
                            font-weight: bold;
                            color: #374151;
                        }
                        .stats-grid {
                            display: grid;
                            grid-template-cols: 1fr 1fr;
                            gap: 15px;
                            margin-bottom: 30px;
                        }
                        .stat-box {
                            border: 1px solid #e5e7eb;
                            padding: 15px;
                            border-radius: 16px;
                            background-color: #f9fafb;
                            text-align: center;
                        }
                        .stat-box .val {
                            font-size: 24px;
                            font-weight: 900;
                            margin: 5px 0;
                        }
                        .stat-box .lbl {
                            font-size: 11px;
                            color: #6b7280;
                            font-weight: bold;
                        }
                        .progress-section {
                            border: 1px solid #e5e7eb;
                            padding: 20px;
                            border-radius: 16px;
                            background-color: #ffffff;
                            margin-bottom: 30px;
                        }
                        .progress-section h3 {
                            font-size: 15px;
                            font-weight: 800;
                            margin: 0 0 15px 0;
                        }
                        .progress-bar-container {
                            width: 100%;
                            height: 10px;
                            background-color: #e5e7eb;
                            border-radius: 9999px;
                            overflow: hidden;
                            margin: 10px 0;
                        }
                        .progress-bar {
                            height: 100%;
                            background-color: #18181b;
                        }
                        .progress-lbls {
                            display: flex;
                            justify-content: space-between;
                            font-size: 10px;
                            color: #6b7280;
                            font-weight: bold;
                        }
                        .exams-section h3 {
                            font-size: 15px;
                            font-weight: 800;
                            margin: 0 0 15px 0;
                        }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 30px;
                            border: 1px solid #e5e7eb;
                            border-radius: 12px;
                            overflow: hidden;
                        }
                        th {
                            background-color: #f9fafb;
                            text-align: right;
                            font-weight: 800;
                            font-size: 12px;
                            padding: 12px;
                            border-bottom: 1px solid #e5e7eb;
                        }
                        td {
                            padding: 12px;
                            border-bottom: 1px solid #e5e7eb;
                            font-size: 13px;
                        }
                        .score-badge {
                            font-weight: bold;
                            padding: 4px 10px;
                            border-radius: 8px;
                            font-size: 11px;
                        }
                        .score-high {
                            background-color: #dcfce7;
                            color: #15803d;
                        }
                        .score-medium {
                            background-color: #ffedd5;
                            color: #c2410c;
                        }
                        .score-low {
                            background-color: #fee2e2;
                            color: #b91c1c;
                        }
                        .note-section {
                            border: 1px solid #e5e7eb;
                            background-color: #f9fafb;
                            padding: 20px;
                            border-radius: 16px;
                            margin-bottom: 40px;
                        }
                        .note-section h3 {
                            font-size: 15px;
                            font-weight: 800;
                            margin: 0 0 10px 0;
                        }
                        .note-content {
                            font-size: 13px;
                            white-space: pre-wrap;
                            color: #374151;
                        }
                        .footer {
                            border-top: 1px solid #e5e7eb;
                            padding-top: 15px;
                            display: flex;
                            justify-content: space-between;
                            font-size: 11px;
                            color: #9ca3af;
                            font-weight: bold;
                        }
                    </style>
                </head>
                <body>
                    <div class="report-container">
                        <div class="header">
                            <div class="title-section">
                                <span class="badge-role">تقرير أداء دراسي</span>
                                <h1>أكاديمية المنارة التعليمية</h1>
                                <p>تقرير تفاعلي وموثق لمتابعة مستوى أداء الطالب</p>
                            </div>
                            <div class="date-section">
                                <div>تاريخ الإصدار: ${formatDate(report.created_at)}</div>
                                <div>تاريخ الصلاحية: ${formatDate(report.expires_at)}</div>
                                <div style="color:#18181b; font-weight:bold; margin-top:5px;">معلم المادة: ${report.instructor_name}</div>
                            </div>
                        </div>

                        <div class="student-card">
                            <div class="avatar">
                                ${report.student_avatar 
                                    ? `<img src="${report.student_avatar}" alt="" />`
                                    : report.student_name.charAt(0)
                                }
                            </div>
                            <div class="student-info">
                                <h3>${report.student_name}</h3>
                                <span>الكورس: ${report.course_title}</span>
                            </div>
                        </div>

                        <div class="stats-grid">
                            <div class="stat-box">
                                <div style="background-color:#fff7ed; color:#ea580c; width:35px; height:35px; border-radius:8px; display:flex; align-items:center; justify-content:center; margin:0 auto 10px auto; font-weight:bold;">H</div>
                                <div class="val">${report.stats.attendance_rate}%</div>
                                <div class="lbl">نسبة حضور المحاضرات (${report.stats.completed_lessons_count} / ${report.stats.total_lessons_count})</div>
                            </div>
                            <div class="stat-box">
                                <div style="background-color:#f0fdf4; color:#16a34a; width:35px; height:35px; border-radius:8px; display:flex; align-items:center; justify-content:center; margin:0 auto 10px auto; font-weight:bold;">G</div>
                                <div class="val">${report.stats.average_score}%</div>
                                <div class="lbl">المعدل الكلي للدرجات</div>
                            </div>
                        </div>

                        <div class="progress-section">
                            <h3>نسبة تقدم الطالب في المقرر</h3>
                            <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:bold;">
                                <span style="color:#6b7280;">نسبة الفيديوهات والملفات المكتملة</span>
                                <span style="color:#18181b;">${report.stats.progress}%</span>
                            </div>
                            <div class="progress-bar-container">
                                <div class="progress-bar" style="width: ${report.stats.progress}%;"></div>
                            </div>
                            <div class="progress-lbls">
                                <span>بداية الكورس</span>
                                ${report.stats.last_accessed ? `<span>آخر نشاط للطالب: ${formatDate(report.stats.last_accessed)}</span>` : ''}
                                <span>اكتمال المقرر</span>
                            </div>
                        </div>

                        <div class="exams-section">
                            <h3>تفاصيل سجل الدرجات والامتحانات</h3>
                            ${report.exams && report.exams.length > 0 ? `
                                <table>
                                    <thead>
                                        <tr>
                                            <th>الامتحان / التقييم</th>
                                            <th>درجة الطالب</th>
                                            <th>أعلى درجة بالفصل</th>
                                            <th>تاريخ التقديم</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${report.exams.map((exam: any) => `
                                            <tr>
                                                <td style="font-weight:bold;">${exam.title}</td>
                                                <td>
                                                    <span class="score-badge ${exam.score >= 80 ? 'score-high' : exam.score >= 50 ? 'score-medium' : 'score-low'}">
                                                        ${exam.score}%
                                                    </span>
                                                </td>
                                                <td style="font-weight:bold; color:#4b5563;">${exam.highest_score}%</td>
                                                <td style="color:#6b7280;">${formatDate(exam.submitted_at)}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            ` : `
                                <div style="text-align:center; padding:30px; border: 1px dashed #d1d5db; border-radius:12px; color:#6b7280; font-size:13px;">
                                    لا توجد درجات مسجلة في هذا التقرير حالياً.
                                </div>
                            `}
                        </div>

                        ${report.manual_note ? `
                            <div class="note-section">
                                <h3>توجيهات وملاحظات معلم المادة</h3>
                                <div class="note-content">${report.manual_note}</div>
                            </div>
                        ` : ''}

                        <div class="footer">
                            <div>أكاديمية المنارة © ٢٠٢٦ - تم التوليد بشكل رسمي وموثق.</div>
                            <div style="color:#18181b;">تقرير مُنشأ بواسطة أكاديمية المنارة 🌟</div>
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
        }, 250);
    };

    async function fetchReport(reportId: string) {
        setIsLoading(true)
        try {
            const response = await fetch(`/api/reports/${reportId}`)
            if (response.ok) {
                const data = await response.json()
                const expDate = new Date(data.expires_at)
                const today = new Date()

                if (today.getTime() > expDate.getTime()) {
                    setIsExpired(true)
                } else {
                    setReport(data)
                }
            } else {
                setReport(null) // Not found
            }
        } catch (error) {
            console.error("Error fetching parent report:", error)
            setReport(null)
        } finally {
            setIsLoading(false)
        }
    }

    // Helper to format Date Arabic
    const formatDate = (isoString: string) => {
        if (!isoString) return ""
        return new Date(isoString).toLocaleDateString("ar-EG", {
            year: "numeric",
            month: "long",
            day: "numeric"
        })
    }

    if (isLoading) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-muted/20">
                <GraduationCap className="h-10 w-10 animate-bounce text-primary mb-4" />
                <p className="font-bold text-muted-foreground italic font-arabic animate-pulse">جاري تحميل تقرير الطالب...</p>
            </div>
        )
    }

    // Report expired or not found view
    if (isExpired || !report) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/10 p-4 font-arabic">
                <Card className="max-w-md w-full border-2 border-dashed shadow-2xl glass rounded-3xl overflow-hidden animate-in zoom-in-95 duration-300">
                    <CardContent className="p-8 text-center flex flex-col items-center gap-6">
                        <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 animate-pulse border border-red-200">
                            <AlertOctagon className="h-8 w-8" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-black text-zinc-800">التقرير غير متاح حالياً ⚠️</h2>
                            <p className="text-sm font-bold text-muted-foreground leading-relaxed text-balance">
                                {isExpired 
                                    ? "عذراً، لقد انتهت صلاحية هذا الرابط السري. صلاحية تقارير المتابعة هي 30 يوماً فقط لحماية بيانات الطالب." 
                                    : "عذراً، لم نتمكن من العثور على هذا التقرير في النظام. برجاء التأكد من صحة الرابط أو التواصل مع المعلم."
                                }
                            </p>
                        </div>
                        <div className="bg-primary/5 p-4 rounded-2xl border text-xs text-primary font-bold">
                            الرجاء التواصل مع معلم المادة للحصول على تقرير متابعة جديد ومحدث.
                        </div>
                        <Button className="w-full h-11 rounded-xl font-bold" onClick={() => router.push("/")}>
                            الذهاب للرئيسية
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-muted/10 py-10 px-4 font-arabic selection:bg-primary/10">
            <div className="max-w-4xl mx-auto space-y-8 pb-20">
                {/* Print Control Buttons (Hidden when printing) */}
                <div className="flex items-center justify-between border-b pb-4 print:hidden">
                    <div className="flex items-center gap-2">
                        <GraduationCap className="h-8 w-8 text-primary" />
                        <span className="font-bold text-lg text-primary">أكاديمية المنارة</span>
                    </div>
                    <Button className="rounded-xl font-bold h-11 px-6 shadow-lg shadow-primary/10 gap-2" onClick={handlePrint}>
                        <Printer className="h-4 w-4" />
                        تصدير كـ PDF / طباعة التقرير
                    </Button>
                </div>

                {/* MAIN REPORT DOCUMENT */}
                <Card className="border-2 border-zinc-200 shadow-xl overflow-hidden bg-background rounded-3xl relative animate-in fade-in duration-500">
                    {/* Decorative Top Line */}
                    <div className="h-2 w-full bg-gradient-to-l from-primary via-primary/50 to-primary/80" />

                    <CardContent className="p-8 md:p-12 space-y-8">
                        {/* Branded Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-100">
                            <div className="space-y-2 text-right">
                                <span className="text-[10px] font-black uppercase bg-primary/10 text-primary px-3 py-1 rounded-full w-fit block tracking-wider">تقرير أداء دراسي</span>
                                <h1 className="text-3xl font-black text-zinc-900 leading-tight">أكاديمية المنارة التعليمية</h1>
                                <p className="text-sm font-bold text-zinc-500">تقرير تفاعلي وموثق لمتابعة مستوى أداء الطالب</p>
                            </div>
                            <div className="text-right md:text-left font-bold text-xs text-muted-foreground flex flex-col gap-1 shrink-0">
                                <span className="flex items-center md:justify-end gap-1.5 font-bold">
                                    <Calendar className="h-4 w-4 text-zinc-400" />
                                    تاريخ الإصدار: {formatDate(report.created_at)}
                                </span>
                                <span className="flex items-center md:justify-end gap-1.5 font-bold">
                                    <Clock className="h-4 w-4 text-zinc-400" />
                                    تاريخ الصلاحية: {formatDate(report.expires_at)}
                                </span>
                                <span className="flex items-center md:justify-end gap-1.5 font-bold text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10 mt-1 w-fit md:mr-auto">
                                    معلم المادة: {report.instructor_name}
                                </span>
                            </div>
                        </div>

                        {/* Student Profile Card */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                            {/* Student Info Box */}
                            <div className="md:col-span-1 border-2 border-zinc-100 rounded-3xl bg-zinc-50/50 p-6 flex flex-col items-center justify-center text-center gap-4 relative">
                                <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-3xl border-2 border-primary/20 shadow-inner overflow-hidden">
                                    {report.student_avatar ? (
                                        <img src={report.student_avatar} className="w-full h-full object-cover" alt="" />
                                    ) : (
                                        report.student_name.charAt(0)
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <h3 className="font-black text-lg text-zinc-800 leading-none">{report.student_name}</h3>
                                    <span className="text-[10px] font-bold text-muted-foreground bg-zinc-100 px-2.5 py-0.5 rounded block w-fit mx-auto mt-2">
                                        الكورس: {report.course_title}
                                    </span>
                                </div>
                            </div>

                            {/* Core Stats Overview */}
                            <div className="md:col-span-2 grid grid-cols-2 gap-4">
                                <div className="border border-zinc-100 p-5 rounded-3xl bg-zinc-50/20 flex flex-col items-center justify-center text-center gap-2 hover:bg-zinc-50/50 transition-colors">
                                    <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600 border border-orange-100">
                                        <Activity className="h-5 w-5" />
                                    </div>
                                    <p className="text-2xl font-black text-zinc-800 tabular-nums">
                                        {report.stats.attendance_rate}%
                                    </p>
                                    <div className="text-[10px] font-bold text-muted-foreground">
                                        نسبة حضور المحاضرات ({report.stats.completed_lessons_count} / {report.stats.total_lessons_count})
                                    </div>
                                </div>

                                <div className="border border-zinc-100 p-5 rounded-3xl bg-zinc-50/20 flex flex-col items-center justify-center text-center gap-2 hover:bg-zinc-50/50 transition-colors">
                                    <div className="p-2.5 rounded-xl bg-green-50 text-green-700 border border-green-100">
                                        <Award className="h-5 w-5" />
                                    </div>
                                    <p className="text-2xl font-black text-zinc-800 tabular-nums">
                                        {report.stats.average_score}%
                                    </p>
                                    <div className="text-[10px] font-bold text-muted-foreground">
                                        المعدل الكلي للدرجات
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Course Progress Section */}
                        <div className="space-y-3 pt-4 border-t border-zinc-100">
                            <h3 className="font-black text-base text-zinc-800 flex items-center gap-2">
                                <TrendingUp className="h-5 w-5 text-primary" />
                                نسبة تقدم الطالب في المقرر
                            </h3>
                            <div className="space-y-2 bg-zinc-50/30 p-5 rounded-2xl border border-zinc-100">
                                <div className="flex justify-between items-center text-xs font-bold px-1">
                                    <span className="text-muted-foreground">نسبة الفيديوهات والملفات المكتملة</span>
                                    <span className="text-primary font-black tabular-nums">{report.stats.progress}%</span>
                                </div>
                                <Progress value={report.stats.progress} className="h-3 bg-zinc-100 border shadow-inner" />
                                <div className="flex justify-between text-[10px] font-bold text-muted-foreground pt-1.5 px-1 leading-none">
                                    <span>بداية الكورس</span>
                                    {report.stats.last_accessed && (
                                        <span>آخر نشاط للطالب: {formatDate(report.stats.last_accessed)}</span>
                                    )}
                                    <span>اكتمال المقرر</span>
                                </div>
                            </div>
                        </div>

                        {/* Exams Performance History */}
                        <div className="space-y-4 pt-4 border-t border-zinc-100">
                            <h3 className="font-black text-base text-zinc-800 flex items-center gap-2">
                                <FileText className="h-5 w-5 text-primary" />
                                تفاصيل سجل الدرجات والامتحانات
                            </h3>

                            {report.exams && report.exams.length > 0 ? (
                                <div className="border border-zinc-200 rounded-2xl overflow-hidden bg-background">
                                    <Table className="font-arabic min-w-full">
                                        <TableHeader className="bg-zinc-50 border-b">
                                            <TableRow>
                                                <TableHead className="text-right font-black text-zinc-700">الامتحان / التقييم</TableHead>
                                                <TableHead className="text-right font-black text-zinc-700">درجة الطالب</TableHead>
                                                <TableHead className="text-right font-black text-zinc-700">أعلى درجة بالفصل</TableHead>
                                                <TableHead className="text-right font-black text-zinc-700">تاريخ التقديم</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {report.exams.map((exam: any, idx: number) => (
                                                <TableRow key={idx} className="hover:bg-zinc-50/50">
                                                    <TableCell className="font-bold py-3.5">{exam.title}</TableCell>
                                                    <TableCell className="py-3.5">
                                                        <span className={`text-sm font-black px-3 py-1.5 rounded-xl ${exam.score >= 80 ? 'bg-green-100 text-green-700' : exam.score >= 50 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-600'}`}>
                                                            {exam.score}%
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-xs font-black text-zinc-600 tabular-nums py-3.5">{exam.highest_score}%</TableCell>
                                                    <TableCell className="text-xs font-bold text-muted-foreground tabular-nums py-3.5">{formatDate(exam.submitted_at)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <div className="text-center py-10 bg-zinc-50/30 rounded-2xl border border-dashed flex flex-col items-center gap-2">
                                    <Award className="h-10 w-10 text-zinc-400 opacity-30" />
                                    <p className="font-bold text-muted-foreground text-sm">لا توجد درجات مسجلة في هذا التقرير حالياً.</p>
                                </div>
                            )}
                        </div>

                        {/* Instructor's Note */}
                        {report.manual_note && (
                            <div className="space-y-3 pt-4 border-t border-zinc-100">
                                <h3 className="font-black text-base text-zinc-800 flex items-center gap-2">
                                    <HeartHandshake className="h-5 w-5 text-primary" />
                                    توجيهات وملاحظات معلم المادة
                                </h3>
                                <div className="p-6 rounded-3xl bg-primary/5 border border-primary/10 text-sm font-medium leading-relaxed whitespace-pre-wrap text-zinc-700 text-right">
                                    {report.manual_note}
                                </div>
                            </div>
                        )}

                        {/* Branded Footer */}
                        <div className="pt-8 border-t border-zinc-100 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-bold text-muted-foreground">
                            <p>أكاديمية المنارة © ٢٠٢٦ - تم التوليد بشكل رسمي وموثق.</p>
                            <p className="text-primary font-black">تقرير مُنشأ بواسطة أكاديمية المنارة 🌟</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* CSS Print Styles */}
            <style jsx global>{`
                @media print {
                    @page {
                        size: A4;
                        margin: 15mm 15mm 15mm 15mm;
                    }
                    body {
                        background-color: white !important;
                        color: black !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .min-h-screen {
                        min-height: auto !important;
                        padding: 0 !important;
                        background: none !important;
                    }
                    .max-w-4xl {
                        max-width: 100% !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    .print\:hidden {
                        display: none !important;
                    }
                    .shadow-xl, .border-2 {
                        box-shadow: none !important;
                        border: 1px solid #e4e4e7 !important;
                    }
                    .rounded-3xl {
                        border-radius: 1.5rem !important;
                        border: 1px solid #e4e4e7 !important;
                    }
                    .bg-zinc-50\/50, .bg-zinc-50\/20, .bg-primary\/5, .bg-zinc-50 {
                        background-color: #f4f4f5 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .bg-orange-50 {
                        background-color: #fff7ed !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .bg-green-50 {
                        background-color: #f0fdf4 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .text-primary {
                        color: #18181b !important;
                    }
                    .bg-primary {
                        background-color: #18181b !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    table {
                        border-collapse: collapse !important;
                        width: 100% !important;
                    }
                    th, td {
                        border: 1px solid #e2e8f0 !important;
                        padding: 10px 8px !important;
                    }
                }
            `}</style>
        </div>
    )
}
