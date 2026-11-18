import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requirePermission } from "@/lib/server-auth";
import { PLANS, PLAN_LIST, getEffectivePlan, type PlanId } from "@/lib/plans";
import { inRange, isMoneySale, parseDateRange, readSaleRecord, roundMoney as r2 } from "@/lib/sales";

type Agg = { sales: number; paid: number; grossCommission: number; platformNet: number; instructorShare: number };
const emptyAgg = (): Agg => ({ sales: 0, paid: 0, grossCommission: 0, platformNet: 0, instructorShare: 0 });
const roundAgg = <T extends Agg>(a: T): T => ({
    ...a, paid: r2(a.paid), grossCommission: r2(a.grossCommission), platformNet: r2(a.platformNet), instructorShare: r2(a.instructorShare),
});

function planRows(map: Map<PlanId, Agg>) {
    return PLAN_LIST.filter((p) => map.has(p.id)).map((p) => roundAgg({ planId: p.id, rate: PLANS[p.id].commissionRate, ...map.get(p.id)! }));
}

/**
 * GET /api/admin/finance/commissions?from=YYYY-MM-DD&to=YYYY-MM-DD   (finance.view)
 * Platform commission per plan / per instructor from stored sale splits + plan subscription income.
 */
export async function GET(request: Request) {
    try {
        const user = await requirePermission(request, "finance.view");
        if (!user) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const range = parseDateRange(new URL(request.url).searchParams);
        if (!range.ok) {
            return NextResponse.json({ error: range.error }, { status: 400 });
        }

        const [enrSnap, subsSnap] = await Promise.all([
            adminDb.collection("enrollments")
                .where("enrolled_at", ">=", range.fromIso)
                .where("enrolled_at", "<=", range.toIso)
                .get(),
            adminDb.collection("transactions").where("type", "==", "plan_subscription").get(),
        ]);

        const totals = { ...emptyAgg(), platformCouponCost: 0 };
        const byPlan = new Map<PlanId, Agg>();
        const byInstructor = new Map<string, { instructorId: string; name: string; agg: Agg; plans: Map<PlanId, Agg> }>();

        for (const d of enrSnap.docs) {
            const data = d.data();
            const s = readSaleRecord(data);
            if (!isMoneySale(s)) continue;
            const add = (a: Agg) => {
                a.sales += 1; a.paid += s.paid; a.grossCommission += s.grossCommission;
                a.platformNet += s.platformNet; a.instructorShare += s.instructorShare;
            };
            add(totals);
            totals.platformCouponCost += s.platformCouponCost;

            if (!byPlan.has(s.planId)) byPlan.set(s.planId, emptyAgg());
            add(byPlan.get(s.planId)!);

            const iid = String(data.instructor_id || "");
            let inst = byInstructor.get(iid);
            if (!inst) {
                inst = { instructorId: iid, name: data.instructor_name || "", agg: emptyAgg(), plans: new Map() };
                byInstructor.set(iid, inst);
            }
            if (!inst.name && data.instructor_name) inst.name = data.instructor_name;
            add(inst.agg);
            if (!inst.plans.has(s.planId)) inst.plans.set(s.planId, emptyAgg());
            add(inst.plans.get(s.planId)!);
        }

        // Current plan + name for each instructor
        const ids = [...byInstructor.keys()].filter((id) => id && !id.includes("/"));
        const privMap = new Map<string, FirebaseFirestore.DocumentData>();
        const pubMap = new Map<string, FirebaseFirestore.DocumentData>();
        for (let i = 0; i < ids.length; i += 300) {
            const chunk = ids.slice(i, i + 300);
            const [privs, pubs] = await Promise.all([
                adminDb.getAll(...chunk.map((id) => adminDb.collection("profiles_private").doc(id))),
                adminDb.getAll(...chunk.map((id) => adminDb.collection("profiles").doc(id))),
            ]);
            privs.forEach((s) => { if (s.exists) privMap.set(s.id, s.data() || {}); });
            pubs.forEach((s) => { if (s.exists) pubMap.set(s.id, s.data() || {}); });
        }

        const instructors = [...byInstructor.values()]
            .map((inst) => ({
                instructorId: inst.instructorId,
                name: pubMap.get(inst.instructorId)?.full_name || inst.name || "",
                currentPlanId: inst.instructorId ? getEffectivePlan(privMap.get(inst.instructorId)).planId : null,
                ...roundAgg(inst.agg),
                byPlan: planRows(inst.plans),
            }))
            .sort((a, b) => b.paid - a.paid);

        let subTotal = 0;
        let subCount = 0;
        subsSnap.docs.forEach((d) => {
            const t = d.data();
            if (t.status && t.status !== "completed") return;
            if (!inRange(t.created_at, range.fromIso, range.toIso)) return;
            subTotal += Number(t.amount || 0) || 0;
            subCount += 1;
        });

        return NextResponse.json({
            range: { from: range.from, to: range.to },
            totals: { ...roundAgg(totals), platformCouponCost: r2(totals.platformCouponCost) },
            byPlan: planRows(byPlan),
            byInstructor: instructors,
            subscriptions: { total: r2(subTotal), count: subCount },
        });
    } catch (err) {
        console.error("Admin finance commissions GET error:", err);
        return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
    }
}
