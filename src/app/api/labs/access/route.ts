import { NextResponse } from "next/server";
import { getServerAuth, logAccessDenied } from "@/lib/server-auth";
import { isBackofficeRole } from "@/lib/permissions";
import { createPlanAccessCache, instructorHasAccess, studentHasLabsAccess } from "@/lib/plan-access";

export const dynamic = "force-dynamic";

type LabsAccessReason = "ok" | "guest" | "no_plan_access" | "instructor_preview";

/**
 * GET /api/labs/access
 * Who may open a virtual lab experiment (/labs/[id]):
 *  - admin / backoffice staff → ok
 *  - instructor → always allowed (preview of what their students get); reason "instructor_preview"
 *    when their own plan lacks `labs`
 *  - student → only with an active enrollment in a course whose instructor's plan has `labs`
 *  - guest → not allowed
 */
export async function GET(request: Request) {
    const json = (allowed: boolean, reason: LabsAccessReason, role: string | null) =>
        NextResponse.json({ allowed, reason, role }, { headers: { "Cache-Control": "private, no-store" } });

    try {
        const user = await getServerAuth(request);
        if (!user) return json(false, "guest", null);

        if (user.role === "admin" || isBackofficeRole(user.role)) {
            return json(true, "ok", user.role);
        }

        const cache = createPlanAccessCache();

        if (user.role === "instructor") {
            const ownLabs = await instructorHasAccess(user.uid, "labs", cache);
            return json(true, ownLabs ? "ok" : "instructor_preview", user.role);
        }

        if (await studentHasLabsAccess(user.uid, cache)) {
            return json(true, "ok", user.role);
        }

        // Deduped per user + path + permission (1/min) inside logAccessDenied.
        logAccessDenied(request, user, "labs.access", "لا يوجد اشتراك نشط في كورس مدرسه على باقة تتضمن المعامل");
        return json(false, "no_plan_access", user.role);
    } catch (err) {
        console.error("Labs access check error:", err);
        return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
    }
}
