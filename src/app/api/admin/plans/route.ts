import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requirePermission } from "@/lib/server-auth";
import { getEffectivePlan } from "@/lib/plans";

/**
 * GET /api/admin/plans  (plans.manage)
 * All plan requests (newest first, limit 200) + every instructor with their current plan.
 */
export async function GET(request: Request) {
    try {
        const user = await requirePermission(request, "plans.manage");
        if (!user) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const [requestsSnap, instructorsSnap] = await Promise.all([
            adminDb.collection("plan_requests").orderBy("created_at", "desc").limit(200).get(),
            adminDb.collection("profiles").where("role", "==", "instructor").get(),
        ]);

        const requests = requestsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const privateRefs = instructorsSnap.docs.map((d) => adminDb.collection("profiles_private").doc(d.id));
        const privateSnaps = privateRefs.length ? await adminDb.getAll(...privateRefs) : [];
        const privateMap = new Map<string, FirebaseFirestore.DocumentData>();
        privateSnaps.forEach((s) => {
            if (s.exists) privateMap.set(s.id, s.data() || {});
        });

        const instructors = instructorsSnap.docs.map((d) => {
            const pub = d.data();
            const priv = privateMap.get(d.id) || {};
            const eff = getEffectivePlan(priv);
            return {
                id: d.id,
                full_name: pub.full_name || "",
                email: priv.email || pub.email || "",
                planId: eff.planId,
                expiresAt: eff.expiresAt,
                expired: eff.expired,
                commissionRate: eff.commissionRate,
            };
        });

        return NextResponse.json({ requests, instructors });
    } catch (err) {
        console.error("Admin plans GET error:", err);
        return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
    }
}
