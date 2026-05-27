import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { virtualLabs, Subject } from "@/lib/labs-data"
import { ArrowLeft, Beaker, Calculator, Zap } from "lucide-react"

export const metadata = {
  title: "المختبرات الافتراضية | أكاديمية المنارة",
  description: "تجارب علمية تفاعلية مجانية في الفيزياء والكيمياء والرياضيات.",
}

const subjectIcons: Record<Subject, React.ReactNode> = {
  physics: <Zap className="w-8 h-8 text-blue-500" />,
  chemistry: <Beaker className="w-8 h-8 text-emerald-500" />,
  math: <Calculator className="w-8 h-8 text-purple-500" />,
}

const subjectTitles: Record<Subject, string> = {
  physics: "الفيزياء",
  chemistry: "الكيمياء",
  math: "الرياضيات",
}

export default function LabsIndexPage() {
    return (
        <div className="min-h-screen flex flex-col bg-background">
            <Navbar />
            <main className="flex-1 py-12">
                <div className="container max-w-6xl mx-auto px-4" dir="rtl">
                    <div className="mb-16 text-center">
                        <div className="inline-flex items-center rounded-full border border-primary/20 px-4 py-1.5 text-sm font-semibold transition-all hover:border-primary/50 mb-6 glass shadow-sm">
                            <span className="text-primary mx-1">جديد المنارة:</span>
                            المختبرات الافتراضية
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black text-foreground mb-6">تجارب علمية <span className="text-primary">بين يديك</span></h1>
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                            استكشف وتعلّم من خلال محاكيات PhET التفاعلية. قم بإجراء التجارب العلمية بأمان ومتعة مباشرة من جهازك في مواد الفيزياء، الكيمياء، والرياضيات.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {virtualLabs.map((lab) => (
                            <Link key={lab.id} href={`/labs/${lab.id}`} className="group block h-full">
                                <div className="glass-card p-8 h-full flex flex-col hover:border-primary/50 transition-colors relative overflow-hidden">
                                    <div className={`absolute top-0 left-0 w-32 h-32 opacity-10 rounded-br-full -z-10 transition-transform group-hover:scale-150 ${lab.color}`} />
                                    
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-white/5 shadow-sm border border-white/10 group-hover:bg-primary/5 transition-colors">
                                            {subjectIcons[lab.subject]}
                                        </div>
                                        <div className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold bg-muted text-muted-foreground">
                                            {subjectTitles[lab.subject]}
                                        </div>
                                    </div>
                                    
                                    <h3 className="text-2xl font-bold mb-3">{lab.title}</h3>
                                    
                                    <p className="text-muted-foreground text-sm leading-relaxed mb-8 flex-1">
                                        {lab.description}
                                    </p>
                                    
                                    <div className="mt-auto flex items-center text-primary font-bold text-sm group-hover:gap-3 transition-all">
                                        بدء التجربة <ArrowLeft className="w-4 h-4 mr-2" />
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    )
}
