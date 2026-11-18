import { LabVisitLogger } from "@/components/labs/lab-visit-logger"
import { LabGuestGate } from "@/components/labs/lab-guest-gate"

export default function LabsLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <LabVisitLogger />
            <LabGuestGate />
            {children}
        </>
    )
}
