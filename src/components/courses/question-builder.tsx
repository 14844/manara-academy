"use client"

import { useState } from "react"
import { Plus, Trash2, CheckCircle2, AlertCircle, HelpCircle, ImageIcon, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { FileUploader } from "@/components/file-uploader"

interface Question {
    id: string
    text: string
    imageUrl?: string
    options: string[]
    correctAnswer: number
    points?: number
    type?: 'mcq' | 'essay'
}

interface QuestionBuilderProps {
    questions: Question[]
    onChange: (questions: Question[]) => void
}

export function QuestionBuilder({ questions, onChange }: QuestionBuilderProps) {
    const addQuestion = () => {
        const newQuestion: Question = {
            id: Math.random().toString(36).substr(2, 9),
            text: "",
            options: ["", "", "", ""],
            correctAnswer: 0,
            points: 1,
            type: 'mcq'
        }
        onChange([...questions, newQuestion])
    }

    const updateQuestion = (idx: number, updates: Partial<Question>) => {
        const newQuestions = [...questions]
        newQuestions[idx] = { ...newQuestions[idx], ...updates }
        onChange(newQuestions)
    }

    const removeQuestion = (idx: number) => {
        onChange(questions.filter((_, i) => i !== idx))
    }

    return (
        <div className="space-y-6 font-arabic rtl">
            <div className="flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    أسئلة الاختبار ({questions.length})
                </h3>
                <Button onClick={addQuestion} size="sm" variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" />
                    إضافة سؤال
                </Button>
            </div>

            {questions.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 bg-muted/20 border-2 border-dashed rounded-xl">
                    <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">لم يتم إضافة أي أسئلة بعد.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {questions.map((q, qIdx) => (
                        <Card key={q.id} className="border shadow-sm">
                            <CardContent className="p-4 space-y-4">
                                <div className="flex items-start gap-4">
                                    <span className="bg-muted h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-2">
                                        {qIdx + 1}
                                    </span>
                                    <div className="flex-1 space-y-4 text-right">
                                        <div className="flex flex-col md:flex-row gap-4">
                                            <div className="flex-1 space-y-2">
                                                <Label className="text-xs">نص السؤال (اختياري في حال وجود صورة)</Label>
                                                <Input
                                                    value={q.text}
                                                    onChange={(e) => updateQuestion(qIdx, { text: e.target.value })}
                                                    placeholder="اكتب السؤال هنا..."
                                                />
                                            </div>
                                            <div className="w-full md:w-48 space-y-2">
                                                <Label className="text-xs">نوع السؤال</Label>
                                                <RadioGroup
                                                    value={q.type || 'mcq'}
                                                    onValueChange={(val: 'mcq' | 'essay') => updateQuestion(qIdx, { type: val })}
                                                    className="flex gap-4 pt-2"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <RadioGroupItem value="mcq" id={`type-mcq-${qIdx}`} />
                                                        <Label htmlFor={`type-mcq-${qIdx}`}>اختياري</Label>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <RadioGroupItem value="essay" id={`type-essay-${qIdx}`} />
                                                        <Label htmlFor={`type-essay-${qIdx}`}>مقالي</Label>
                                                    </div>
                                                </RadioGroup>
                                            </div>
                                            <div className="w-full md:w-32 space-y-2">
                                                <Label className="text-xs">درجة السؤال</Label>
                                                <Input
                                                    type="number"
                                                    value={q.points || 1}
                                                    onChange={(e) => updateQuestion(qIdx, { points: parseFloat(e.target.value) || 0 })}
                                                    min={0}
                                                    className="h-9"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex flex-col md:flex-row gap-4">
                                            <div className="flex-1 space-y-2">
                                                <Label className="text-xs">صورة السؤال (اختياري)</Label>
                                                {!q.imageUrl ? (
                                                    <FileUploader
                                                        label="رفع صورة"
                                                        folder="questions"
                                                        accept="image/*"
                                                        onUploadComplete={(url) => updateQuestion(qIdx, { imageUrl: url })}
                                                    />
                                                ) : (
                                                    <div className="relative border rounded-lg overflow-hidden aspect-video bg-muted group max-w-sm">
                                                        <img src={q.imageUrl} className="w-full h-full object-contain" alt="Question" />
                                                        <Button
                                                            size="icon"
                                                            variant="destructive"
                                                            className="absolute top-1 left-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onClick={() => updateQuestion(qIdx, { imageUrl: "" })}
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>

                                            {(!q.type || q.type === 'mcq') ? (
                                                <div className="flex-1 space-y-3">
                                                    <Label className="text-xs">الخيارات والحل الصحيح</Label>
                                                    <RadioGroup
                                                        value={q.correctAnswer.toString()}
                                                        onValueChange={(val) => updateQuestion(qIdx, { correctAnswer: parseInt(val) })}
                                                        className="space-y-2"
                                                    >
                                                        {q.options.map((opt, oIdx) => (
                                                            <div key={oIdx} className="flex items-center gap-3">
                                                                <RadioGroupItem value={oIdx.toString()} id={`q${qIdx}-o${oIdx}`} />
                                                                <Input
                                                                    value={opt}
                                                                    onChange={(e) => {
                                                                        const newOpts = [...q.options]
                                                                        newOpts[oIdx] = e.target.value
                                                                        updateQuestion(qIdx, { options: newOpts })
                                                                    }}
                                                                    placeholder={`خيار ${oIdx + 1}`}
                                                                    className={`flex-1 h-9 text-sm ${q.correctAnswer === oIdx ? 'border-primary ring-1 ring-primary' : ''}`}
                                                                />
                                                            </div>
                                                        ))}
                                                    </RadioGroup>
                                                </div>
                                            ) : (
                                                <div className="flex-1 p-6 bg-primary/5 rounded-xl border border-primary/10 flex flex-col items-center justify-center text-center gap-2">
                                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                        <HelpCircle className="h-5 w-5" />
                                                    </div>
                                                    <p className="font-bold text-sm text-primary">سؤال مقالي</p>
                                                    <p className="text-xs text-muted-foreground">سيقوم الطالب بكتابة إجابة نصية، وسيتم تصحيحه يدوياً من قبلك.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => removeQuestion(qIdx)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
