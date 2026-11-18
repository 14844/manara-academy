import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getActiveServerAuth } from "@/lib/server-auth";
import { PLANS, PLAN_LIST, getEffectivePlan, type PlanId } from "@/lib/plans";
import { inRange, isMoneySale, parseDateRange, readSaleRecord, resettleAtRate, roundMoney as r2 } from "@/lib/sales";

/**
 * GET /api/instructor/earnings?from=YYYY-MM-DD&to=YYYY-MM-DD   (active instructor, own data only)
 * Default: last 30 days. Max range 366 days. Days are UTC.
 */
export async function GET(request: Request) {
    try {
        const user = await getActiveServerAuth(request);
        if (!user || user.role !== "instructor") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const range = parseDateRange(new URL(request.url).searchParams);
        if (!range.ok) {
            return NextResponse.json({ error: range.error }, { status: 400 });
        }

        const [privSnap, enrSnap, wdSnap] = await Promise.all([
            adminDb.collection("profiles_private").doc(user.uid).get(),
            adminDb.collection("enrollments").where("instructor_id", "==", user.uid).get(),
            adminDb.collection("withdrawal_requests").where("instructor_id", "==", user.uid).get(),
        ]);
        const priv = privSnap.exists ? privSnap.data() || {} : {};
        const eff = getEffectivePlan(priv);

        type Row = {
            id: string; date: string; course_id: string; course_title: string; student_label: string;
            list_price: number; discount: number; coupon_code: string | null; coupon_source: string | null;
            paid: number; plan_id: PlanId; rate: number; commission: number; instructor_share: number;
        };
        const sales: Row[] = [];
        const byPlan = new Map<PlanId, { planId: PlanId; rate: number; sales: number; paidTotal: number; commission: number; instructorShare: number }>();
        const byMonth = new Map<string, { month: string; sales: number; instructorShare: number; commission: number }>();
        const whatIf: Record<"pro" | "center", number> = { pro: 0, center: 0 };
        const summary = { sales: 0, listTotal: 0, discountTotal: 0, paidTotal: 0, instructorShare: 0, commission: 0 };

        for (const d of enrSnap.docs) {
            const data = d.data();
            const date = data.enrolled_at || data.created_at;
            if (!inRange(date, range.fromIso, range.toIso)) continue;
            const s = readSaleRecord(data);
            if (!isMoneySale(s)) continue;

            const fullName = String(data.student_name || "").trim();
            sales.push({
                id: d.id,
                date,
                course_id: data.course_id || "",
                course_title: data.course_title || "",
                student_label: fullName.includes("@") ? "طالب" : (fullName.split(/\s+/)[0] || "طالب"),
                list_price: s.listPrice,
                discount: s.discount,
                coupon_code: s.couponCode,
                coupon_source: s.couponCode ? s.couponSource : null,
                paid: s.paid,
                plan_id: s.planId,
                rate: s.rate,
                commission: s.grossCommission,
                instructor_share: s.instructorShare,
            });

            summary.sales += 1;
            summary.listTotal += s.listPrice;
            summary.discountTotal += s.discount;
            summary.paidTotal += s.paid;
            summary.instructorShare += s.instructorShare;
            summary.commission += s.grossCommission;

            const p = byPlan.get(s.planId) || { planId: s.planId, rate: PLANS[s.planId].commissionRate, sales: 0, paidTotal: 0, commission: 0, instructorShare: 0 };
            p.sales += 1; p.paidTotal += s.paid; p.commission += s.grossCommission; p.instructorShare += s.instructorShare;
            byPlan.set(s.planId, p);

            const month = date.slice(0, 7);
            const m = byMonth.get(month) || { month, sales: 0, instructorShare: 0, commission: 0 };
            m.sales += 1; m.instructorShare += s.instructorShare; m.commission += s.grossCommission;
            byMonth.set(month, m);

            whatIf.pro += resettleAtRate(s, PLANS.pro.commissionRate).grossCommission;
            whatIf.center += resettleAtRate(s, PLANS.center.commissionRate).grossCommission;
        }

        sales.sort((a, b) => b.date.localeCompare(a.date));
        const commission = r2(summary.commission);
        const pendingWithdrawals = r2(wdSnap.docs
            .map((w) => w.data())
            .filter((w) => w.status === "pending")
            .reduce((sum, w) => sum + (Number(w.net_amount ?? w.amount ?? 0) || 0), 0));

        return NextResponse.json({
            range: { from: range.from, to: range.to },
            currentPlan: { planId: eff.planId, commissionRate: eff.commissionRate, expiresAt: eff.expiresAt, expired: eff.expired },
            summary: {
                sales: summary.sales,
                listTotal: r2(summary.listTotal),
                discountTotal: r2(summary.discountTotal),
                paidTotal: r2(summary.paidTotal),
                instructorShare: r2(summary.instructorShare),
                commission,
                byPlan: PLAN_LIST.map((pl) => byPlan.get(pl.id)).filter((x): x is NonNullable<typeof x> => !!x).map((p) => ({
                    ...p, paidTotal: r2(p.paidTotal), commission: r2(p.commission), instructorShare: r2(p.instructorShare),
                })),
                byMonth: [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)).map((m) => ({
                    ...m, instructorShare: r2(m.instructorShare), commission: r2(m.commission),
                })),
            },
            sales,
            whatIf: {
                pro: { commission: r2(whatIf.pro), savings: Math.max(0, r2(commission - whatIf.pro)) },
                center: { commission: r2(whatIf.center), savings: Math.max(0, r2(commission - whatIf.center)) },
            },
            wallet: { balance: r2(Number(priv.wallet_balance ?? 0) || 0), pendingWithdrawals },
        });
    } catch (err) {
        console.error("Instructor earnings GET error:", err);
        return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
    }
}
