"use client"

import { useState, useEffect, useCallback } from "react"
import { Timer, AlertCircle, CheckCircle2, XCircle, Trophy, Loader2, ArrowLeft, ArrowRight, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { db, auth } from "@/lib/firebase/config"
import { doc, setDoc, collection, serverTimestamp } from "firebase/firestore"

interface Question {
    id: string
    text: string
    imageUrl?: string
    image_url?: string // Fallback for naming inconsistencies
    options: string[]
    correctAnswer: number
    points?: number
}

interface InternalExamProps {
    courseId: string
    lessonId: string
    examData: {
        title: string
        description: string
        duration: string // in minutes
        questions: Question[]
    }
    onComplete: (score: number) => void
    type?: 'exam' | 'assignment'
    initialSubmission?: any
}

export function InternalExam({ courseId, lessonId, examData, onComplete, type = 'exam', initialSubmission }: InternalExamProps) {
    const [started, setStarted] = useState(!!initialSubmission)
    const durationInMinutes = parseInt(examData.duration) || 30 // Default to 30 if data is missing or invalid
    const [timeLeft, setTimeLeft] = useState(durationInMinutes * 60)
    const [currentQuestion, setCurrentQuestion] = useState(0)
    const [answers, setAnswers] = useState<Record<string, number>>(initialSubmission?.answers || {})
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isFinished, setIsFinished] = useState(!!initialSubmission)
    const [score, setScore] = useState(initialSubmission?.score || 0)
    const [showReview, setShowReview] = useState(!!initialSubmission)
    const [tabSwitchCount, setTabSwitchCount] = useState(0)
    const MAX_TAB_SWITCHES = 3

    const finishExam = useCallback(async () => {
        if (isFinished) return
        setIsSubmitting(true)

        let totalPoints = 0
        let earnedPoints = 0
        examData.questions.forEach((q) => {
            const qPts = q.points || 1
            totalPoints += qPts
            if (answers[q.id] === q.correctAnswer) earnedPoints += qPts
        })

        const finalScore = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0
        setScore(finalScore)

        try {
            const user = auth.currentUser
            if (user) {
                const submissionRef = doc(collection(db, "submissions"))
                await setDoc(submissionRef, {
                    id: submissionRef.id,
                    student_id: user.uid,
                    student_name: user.displayName,
                    course_id: courseId,
                    lesson_id: lessonId,
                    type: type,
                    score: finalScore,
                    answers: answers,
                    submitted_at: serverTimestamp(),
                })
            }

            setIsFinished(true)
            toast.success(`تم تسليم الاختبار بنجاح! درجتك: ${finalScore}%`)
            onComplete(finalScore)
        } catch (error) {
            console.error("Error submitting exam:", error)
            toast.error("حدث خطأ أثناء حفظ النتيجة")
        } finally {
            setIsSubmitting(false)
        }
    }, [answers, examData.questions, courseId, lessonId, onComplete, isFinished])

    useEffect(() => {
        if (started && timeLeft > 0 && !isFinished) {
            const timer = setInterval(() => {
                setTimeLeft((prev) => prev - 1)
            }, 1000)
            return () => clearInterval(timer)
        } else if (started && timeLeft === 0 && !isFinished) {
            toast.info("انتهى الوقت المحدد! جاري تسليم إجاباتك تلقائياً...")
            finishExam()
        }
    }, [started, timeLeft, isFinished, finishExam])

    useEffect(() => {
        if (!started || isFinished) return

        const handleVisibilityChange = () => {
            if (document.hidden) {
                setTabSwitchCount(prev => {
                    const newCount = prev + 1
                    if (newCount >= MAX_TAB_SWITCHES) {
                        toast.error("تم تجاوز عدد المرات المسموح بها لتغيير التبويب. جاري إنهاء الاختبار...")
                        finishExam()
                    } else {
                        toast.warning(`تحذير: لقد خرجت من صفحة الاختبار. (محاولة ${newCount} من ${MAX_TAB_SWITCHES})`)
                    }
                    return newCount
                })
            }
        }

        const handleBlur = () => {
            // Some browsers trigger blur when switching windows
            handleVisibilityChange()
        }

        document.addEventListener("visibilitychange", handleVisibilityChange)
        window.addEventListener("blur", handleBlur)

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange)
            window.removeEventListener("blur", handleBlur)
        }
    }, [started, isFinished, finishExam])

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    if (!examData.questions || examData.questions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-muted/20 rounded-xl border-2 border-dashed">
                <AlertCircle className="h-10 w-10 text-muted-foreground mb-4" />
                <h3 className="text-xl font-bold">لا توجد أسئلة مضافة</h3>
                <p className="text-sm text-muted-foreground mt-2">يرجى مراجعة المدرس لإضافة محتوى الاختبار.</p>
            </div>
        )
    }

    if (isFinished) {
        return (
            <div className="animate-in fade-in zoom-in duration-500">
                <Card className="max-w-xl mx-auto border-2 border-primary/20 shadow-2xl">
                    <CardHeader className="text-center pb-2">
                        <div className="flex justify-center mb-4">
                            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                <Trophy className="h-10 w-10" />
                            </div>
                        </div>
                        <CardTitle className="text-3xl font-bold">ملخص النتيجة</CardTitle>
                        <CardDescription>انتهى وقت الاختبار وتم تقييم إجاباتك</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-0">
                        <div className="text-center space-y-2">
                            <div className="text-5xl font-black text-primary">{score}%</div>
                            <p className="font-bold text-muted-foreground">الدرجة النهائية</p>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs font-bold">
                                <span>التقدم في الإنجاز</span>
                                <span>{score}%</span>
                            </div>
                            <Progress value={score} className="h-3" />
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-3 border-t pt-6 bg-muted/10">
                        <Button className="w-full gap-2" variant="outline" onClick={() => setShowReview(!showReview)}>
                            <HelpCircle className="h-4 w-4" />
                            {showReview ? "إخفاء المراجعة" : "راجع إجاباتك وأخطاءك"}
                        </Button>
                        <Button className="w-full" asChild>
                            <label className="cursor-pointer">العودة للدرس التالي</label>
                        </Button>
                    </CardFooter>
                </Card>

                {showReview && (
                    <div className="mt-8 space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-12">
                        <h3 className="text-xl font-bold flex items-center gap-2 px-2">
                            <span className="h-8 w-1 bg-primary rounded-full" />
                            تفاصيل الإجابات والمراجعة
                        </h3>
                        {examData.questions.map((q, qIdx) => {
                            const studentAnswer = answers[q.id]
                            const isCorrect = studentAnswer === q.correctAnswer

                            return (
                                <Card key={q.id} className={`overflow-hidden border-2 ${isCorrect ? 'border-green-100' : 'border-red-100'}`}>
                                    <CardHeader className="pb-3 bg-muted/30">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="space-y-1">
                                                <Badge variant="outline" className="mb-2">السؤال {qIdx + 1}</Badge>
                                                <h4 className="font-bold text-lg leading-relaxed">{q.text}</h4>
                                            </div>
                                            {isCorrect ? (
                                                <div className="shrink-0 h-10 w-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                                                    <CheckCircle2 className="h-6 w-6" />
                                                </div>
                                            ) : (
                                                <div className="shrink-0 h-10 w-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                                                    <XCircle className="h-6 w-6" />
                                                </div>
                                            )}
                                        </div>
                                        {(q.imageUrl || q.image_url) && (
                                            <div className="mt-4 border rounded-lg overflow-hidden max-w-md bg-white">
                                                <img src={q.imageUrl || q.image_url} alt="Question" className="w-full h-auto" />
                                            </div>
                                        )}
                                    </CardHeader>
                                    <CardContent className="pt-4 space-y-3">
                                        {q.options.map((option, oIdx) => {
                                            const isSelected = studentAnswer === oIdx
                                            const isCorrectOption = q.correctAnswer === oIdx

                                            let bgColor = "bg-muted/50"
                                            let borderColor = "border-transparent"
                                            let textColor = "text-foreground"

                                            if (isCorrectOption) {
                                                bgColor = "bg-green-50"
                                                borderColor = "border-green-500"
                                                textColor = "text-green-700 font-bold"
                                            } else if (isSelected && !isCorrect) {
                                                bgColor = "bg-red-50"
                                                borderColor = "border-red-500"
                                                textColor = "text-red-700 font-bold"
                                            }

                                            return (
                                                <div
                                                    key={oIdx}
                                                    className={`p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${bgColor} ${borderColor} ${textColor}`}
                                                >
                                                    <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center text-xs ${isCorrectOption ? 'border-green-500 bg-green-500 text-white' : isSelected ? 'border-red-500 bg-red-500 text-white' : 'border-muted-foreground/30'}`}>
                                                        {oIdx + 1}
                                                    </div>
                                                    <span className="flex-1">{option}</span>
                                                    {isCorrectOption && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                                                    {isSelected && !isCorrect && <XCircle className="h-4 w-4 shrink-0" />}
                                                </div>
                                            )
                                        })}
                                        {!isCorrect && studentAnswer === undefined && (
                                            <p className="text-xs text-red-500 italic mt-2">عذراً، لم تقم بالإجابة على هذا السؤال.</p>
                                        )}
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                )}
            </div>
        )
    }

    if (!started) {
        return (
            <Card className="max-w-2xl mx-auto border-2 shadow-xl">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold">{examData.title}</CardTitle>
                    <CardDescription>{examData.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-primary/5 p-4 rounded-xl flex items-center gap-3">
                            <Timer className="h-6 w-6 text-primary" />
                            <div>
                                <p className="text-[10px] font-bold text-muted-foreground">المدة المحددة</p>
                                <p className="font-bold">{examData.duration} دقيقة</p>
                            </div>
                        </div>
                        <div className="bg-primary/5 p-4 rounded-xl flex items-center gap-3">
                            <CheckCircle2 className="h-6 w-6 text-primary" />
                            <div>
                                <p className="text-[10px] font-bold text-muted-foreground">عدد الأسئلة</p>
                                <p className="font-bold">{examData.questions.length} سؤال</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-4">
                    <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl text-xs text-orange-800 space-y-2">
                        <p className="font-bold flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            تنبيه هام قبل البدء:
                        </p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>عند الخروج من هذه الصفحة أو تغيير التبويب سيتم احتساب محاولة غش.</li>
                            <li>يُسمح لك بترك الصفحة مرتين فقط؛ في المرة الثالثة سيتم إنهاء الاختبار تلقائياً.</li>
                            <li>تأكد من استقرار الإنترنت قبل البدء.</li>
                        </ul>
                    </div>
                    <Button className="w-full text-lg h-14 font-bold" onClick={() => setStarted(true)}>
                        بدء الاختبار الآن
                    </Button>
                </CardFooter>
            </Card>
        )
    }

    const currentQ = examData.questions[currentQuestion]
    const progress = ((currentQuestion + 1) / examData.questions.length) * 100

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            {/* Header / Progress */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 z-20 bg-background/95 backdrop-blur py-4 border-b">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-mono font-bold text-lg shadow-sm border ${timeLeft < 60 ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' : 'bg-primary/10 text-primary border-primary/20'}`}>
                        <Timer className="h-5 w-5" />
                        {formatTime(timeLeft)}
                    </div>
                </div>
                <div className="flex-1 w-full space-y-1">
                    <div className="flex justify-between text-[10px] font-bold px-1 text-muted-foreground">
                        <span>السؤال {currentQuestion + 1} من {examData.questions.length}</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                </div>
                <Button variant="destructive" size="sm" onClick={() => {
                    if (confirm("هل أنت متأكد من رغبتك في تسليم الاختبار الآن؟")) finishExam()
                }}>
                    إنهاء وتسليم
                </Button>
            </div>

            {/* Question Card */}
            <Card className="border-2 shadow-lg min-h-[400px] flex flex-col">
                <CardContent className="p-8 flex-1">
                    <div className="flex flex-col gap-6 mb-8">
                        {(currentQ.imageUrl || currentQ.image_url) && (
                            <div className="w-full border rounded-2xl overflow-hidden bg-muted/30 aspect-video flex items-center justify-center relative group">
                                <img
                                    src={currentQ.imageUrl || currentQ.image_url}
                                    className="w-full h-full object-contain transition-opacity duration-300"
                                    alt="Question content"
                                    onLoad={(e) => (e.currentTarget.style.opacity = '1')}
                                    onError={(e) => {
                                        console.error("Exam Image Failed to load:", currentQ.imageUrl || currentQ.image_url)
                                        e.currentTarget.src = "/placeholder-image.png" // Fallback if available
                                    }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/5 pointer-events-none">
                                    <Badge variant="outline" className="bg-background/80">توضيح السؤال</Badge>
                                </div>
                            </div>
                        )}
                        <h2 className={`text-xl font-bold leading-relaxed ${!currentQ.text ? 'text-muted-foreground italic text-sm' : ''}`}>
                            {currentQ.text || "انظر للصورة المرفقة للإجابة على السؤال"}
                        </h2>
                    </div>
                    <RadioGroup
                        value={answers[currentQ.id]?.toString()}
                        onValueChange={(val) => setAnswers({ ...answers, [currentQ.id]: parseInt(val) })}
                        className="space-y-4"
                    >
                        {currentQ.options.map((opt, idx) => (
                            <div
                                key={idx}
                                className={`flex items-center space-x-2 space-x-reverse border-2 rounded-xl p-4 transition-all cursor-pointer hover:bg-muted ${answers[currentQ.id] === idx ? 'border-primary bg-primary/5 shadow-inner' : 'border-transparent bg-zinc-50'}`}
                                onClick={() => setAnswers({ ...answers, [currentQ.id]: idx })}
                            >
                                <RadioGroupItem value={idx.toString()} id={`q-${currentQ.id}-opt-${idx}`} />
                                <Label htmlFor={`q-${currentQ.id}-opt-${idx}`} className="flex-1 cursor-pointer font-bold text-base leading-relaxed pr-2">
                                    {opt}
                                </Label>
                            </div>
                        ))}
                    </RadioGroup>
                </CardContent>
                <CardFooter className="flex justify-between items-center p-6 bg-muted/20 border-t">
                    <Button
                        variant="outline"
                        disabled={currentQuestion === 0}
                        onClick={() => setCurrentQuestion(prev => prev - 1)}
                        className="gap-2"
                    >
                        <ArrowRight className="h-4 w-4" />
                        السابق
                    </Button>

                    {currentQuestion === examData.questions.length - 1 ? (
                        <Button
                            className="px-8 gap-2"
                            onClick={finishExam}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            تسليم الإجابات
                        </Button>
                    ) : (
                        <Button
                            className="gap-2"
                            onClick={() => setCurrentQuestion(prev => prev + 1)}
                        >
                            التالي
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    )}
                </CardFooter>
            </Card>
        </div>
    )
}
