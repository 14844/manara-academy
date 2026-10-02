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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
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
