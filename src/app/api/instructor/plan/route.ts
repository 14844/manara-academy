import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getActiveServerAuth } from "@/lib/server-auth";
import { getEffectivePlan } from "@/lib/plans";

/**
 * GET /api/instructor/plan
 * Current plan of the signed-in instructor + their pending upgrade request (if any).
 */
export async function GET(request: Request) {
    try {
        const user = await getActiveServerAuth(request);
        if (!user || user.role !== "instructor") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const [privSnap, pendingSnap] = await Promise.all([
            adminDb.collection("profiles_private").doc(user.uid).get(),
            adminDb.collection("plan_requests").where("instructor_id", "==", user.uid).get(),
        ]);

        const eff = getEffectivePlan(privSnap.exists ? privSnap.data() : null);

        const pendingDoc = pendingSnap.docs
            .filter((d) => d.data().status === "pending")
            .sort((a, b) => String(b.data().created_at || "").localeCompare(String(a.data().created_at || "")))[0];
        const pendingRequest = pendingDoc
            ? {
                id: pendingDoc.id,
                requested_plan_id: pendingDoc.data().requested_plan_id,
                months: pendingDoc.data().months,
                amount: pendingDoc.data().amount,
                created_at: pendingDoc.data().created_at,
            }
            : null;

        return NextResponse.json({
            planId: eff.planId,
            expiresAt: eff.expiresAt,
            expired: eff.expired,
            commissionRate: eff.commissionRate,
            pendingRequest,
        });
    } catch (err) {
        console.error("Instructor plan GET error:", err);
        return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
    }
}
