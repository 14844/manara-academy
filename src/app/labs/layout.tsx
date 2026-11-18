import { LabVisitLogger } from "@/components/labs/lab-visit-logger"

export default function LabsLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <LabVisitLogger />
            {children}
        </>
    )
}
