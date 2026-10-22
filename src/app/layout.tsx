import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { SupportButton } from "@/components/support-button";
import { StatusGuard } from "@/components/auth/status-guard";
import "./globals.css";

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["100", "200", "300", "400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans-arabic",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://manara-academy.vercel.app"),
  title: {
    default: "أكاديمية المنارة التعليمية | Manara Academy",
    template: "%s | أكاديمية المنارة التعليمية",
  },
  description: "المنصة التعليمية الرائدة للطلاب والمدرسين - كورسات تفاعلية، ومختبرات افتراضية متطورة، ومتابعة دراسية دقيقة بأحدث التقنيات.",
  keywords: [
    "أكاديمية المنارة",
    "منارة أكاديمي",
    "Manara Academy",
    "منصة كورسات",
    "تعليم تفاعلي",
    "مختبرات افتراضية",
    "كورسات ثانوية عامة",
    "شروحات ومراجعات",
    "منصة تعليمية مصر",
    "أكاديمية المنارة التعليمية"
  ],
  authors: [{ name: "Manara Academy" }],
  creator: "Manara Academy",
  publisher: "Manara Academy",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: "أكاديمية المنارة التعليمية | Manara Academy",
    description: "المنصة التعليمية الشاملة للطلاب والمدرسين في جميع المراحل الدراسية مع تجارب ومختبرات تفاعلية.",
    url: "https://manara-academy.vercel.app",
    siteName: "أكاديمية المنارة التعليمية",
    locale: "ar_EG",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "أكاديمية المنارة التعليمية | Manara Academy",
    description: "المنصة التعليمية الشاملة للطلاب والمدرسين",
  },
  verification: {
    google: "googlec964b7e72c9a3e7d",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://manara-academy.vercel.app/#website",
      "url": "https://manara-academy.vercel.app",
      "name": "أكاديمية المنارة التعليمية",
      "alternateName": ["أكاديمية المنارة", "Manara Academy", "منارة أكاديمي"],
      "description": "المنصة التعليمية الشاملة للطلاب والمدرسين في جميع المراحل الدراسية",
      "inLanguage": "ar"
    },
    {
      "@type": "EducationalOrganization",
      "@id": "https://manara-academy.vercel.app/#organization",
      "name": "أكاديمية المنارة التعليمية",
      "alternateName": "Manara Academy",
      "url": "https://manara-academy.vercel.app",
      "logo": "https://manara-academy.vercel.app/icon",
      "description": "المنصة التعليمية الرائدة للطلاب والمدرسين - كورسات تفاعلية ومختبرات افتراضية"
    },
    {
      "@type": "ItemList",
      "name": "أقسام أكاديمية المنارة الرئيسية",
      "itemListElement": [
        {
          "@type": "SiteNavigationElement",
          "position": 1,
          "name": "تصفح الكورسات والمحاضرات",
          "description": "استكشف أحدث الكورسات التعليمية لشروحات ومراجعات الثانوية العامة",
          "url": "https://manara-academy.vercel.app/courses"
        },
        {
          "@type": "SiteNavigationElement",
          "position": 2,
          "name": "تسجيل الدخول",
          "description": "تسجيل الدخول لحساب الطالب أو المدرس لمتابعة الدروس والواجبات",
          "url": "https://manara-academy.vercel.app/login"
        },
        {
          "@type": "SiteNavigationElement",
          "position": 3,
          "name": "المختبرات الافتراضية",
          "description": "تجارب علمية تفاعلية ومحاكاة لمواد الفيزياء والكيمياء والرياضيات",
          "url": "https://manara-academy.vercel.app/labs"
        },
        {
          "@type": "SiteNavigationElement",
          "position": 4,
          "name": "عن أكاديمية المنارة",
          "description": "تعرف على رؤية المنصة ورسالتها في تطوير المنظومة التعليمية",
          "url": "https://manara-academy.vercel.app/about"
        }
      ]
    }
  ]
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${ibmPlexSansArabic.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-blob" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/20 rounded-full blur-[120px] animate-blob [animation-delay:2s]" />
            <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-purple-500/10 rounded-full blur-[100px] animate-blob [animation-delay:4s]" />
          </div>
          <StatusGuard>
            {children}
            <Toaster position="top-center" />
            <SupportButton />
          </StatusGuard>
        </ThemeProvider>
      </body>
    </html>
  );
}
