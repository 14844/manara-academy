export type Subject = "physics" | "chemistry" | "math"

export interface VirtualLab {
  id: string
  title: string
  description: string
  subject: Subject
  simName: string // used in the PhET URL
  color: string // Tailwind color class for badges/accents
}

export const virtualLabs: VirtualLab[] = [
  {
    id: "circuit-construction-kit",
    title: "الدوائر الكهربائية",
    description: "قم ببناء دوائر كهربائية باستخدام الأسلاك، البطاريات، المصابيح، والمقاومات. اكتشف قانون أوم في بيئة آمنة تفاعلية.",
    subject: "physics",
    simName: "circuit-construction-kit-dc",
    color: "bg-blue-500",
  },
  {
    id: "build-a-molecule",
    title: "بناء الجزيئات",
    description: "اجمع الذرات معاً لبناء جزيئات مختلفة. تعرف على التركيب الكيميائي واستمتع بإنشاء مركبات ثلاثية الأبعاد.",
    subject: "chemistry",
    simName: "build-a-molecule",
    color: "bg-emerald-500",
  },
  {
    id: "function-builder",
    title: "رسم الدوال",
    description: "استكشف كيف تعمل الدوال الرياضية، وابنِ دوالك الخاصة وشاهد كيف تتغير المدخلات والمخرجات بطريقة رسومية.",
    subject: "math",
    simName: "function-builder",
    color: "bg-purple-500",
  }
]
