export type Subject = "physics" | "chemistry" | "math" | "astronomy"

export interface VirtualLab {
  id: string
  title: string
  description: string
  subject: Subject
  simName: string
  color: string
}

export const virtualLabs: VirtualLab[] = [
  {
    id: "circuit-construction-kit",
    title: "الدوائر الكهربائية",
    description: "مختبر ثلاثي الأبعاد تفاعلي: قم ببناء دوائر كهربائية باستخدام مجهزات القدرة، الأسلاك، الريوستات، المصابيح المتوهجة، والمقاييس الرقمية لاكتشاف قانون أوم وقوانين كيرشوف وحماية الدائرة.",
    subject: "physics",
    simName: "circuit-construction-kit-dc",
    color: "bg-blue-500",
  },
  {
    id: "chemical-reactions",
    title: "مختبر التفاعلات الكيميائية والمعادلات",
    description: "معمل كيميائي تفاعلي ثلاثي الأبعاد: اسحب الأواني الزجاجية والأحماض والقواعد ولهب بنزن، وشاهد تغيرات اللون وتصاعد الغازات والترسيب مع التحقق من قانون بقاء الكتلة بالميزان الحساس.",
    subject: "chemistry",
    simName: "chemical-reactions",
    color: "bg-emerald-600",
  },
  {
    id: "build-a-molecule",
    title: "بناء الجزيئات والروابط الكيميائية",
    description: "استكشف الأشكال الهندسية للجزيئات وفق نظرية VSEPR، وتعرف على زوايا الروابط والتهجين ونماذج الكرة والعصا وملء الفراغ، وبناء المركبات العضوية كالكحولات والأحماض.",
    subject: "chemistry",
    simName: "build-a-molecule",
    color: "bg-emerald-500",
  },
  {
    id: "function-builder",
    title: "رسم الدوال والتحويلات الهندسية",
    description: "لوحة بيانية ثلاثية الأبعاد: استكشف التحويلات الهندسية للدوال (التربيعية، المقياس، الكسرية، المثلثية)، مع مماس المنحنى وحساب المشتقة هندسياً والمساحة تحت المنحنى بالتكامل.",
    subject: "math",
    simName: "function-builder",
    color: "bg-purple-500",
  },
  {
    id: "space",
    title: "مختبر الفضاء والمجموعة الشمسية",
    description: "قبة فلكية ومرصد فضائي ثلاثي الأبعاد: استكشف الشمس والكواكب الثمانية وأقمارها، وقوانين كبلر والجاذبية الكونية، وأطوار القمر والكسوف، وصندوق جاذبية نيوتن وحساب وزنك على الكواكب.",
    subject: "astronomy",
    simName: "solar-system-gravity",
    color: "bg-cyan-500",
  },
]
