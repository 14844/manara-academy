import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getServerAuth } from "@/lib/server-auth";

/**
 * POST /api/instructor/plan/intro-seen
 * Marks the one-time plans welcome modal as seen for the signed-in instructor.
 * Writes profiles_private/{uid}.plan_intro_seen_at with server time (idempotent: keeps the first value).
 */
export async function POST(request: Request) {
    try {
        const user = await getServerAuth(request);
        if (!user || user.role !== "instructor") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const ref = adminDb.collection("profiles_private").doc(user.uid);
        await adminDb.runTransaction(async (t) => {
            const snap = await t.get(ref);
            if (snap.exists && typeof snap.data()?.plan_intro_seen_at === "string") return;
            t.set(ref, { plan_intro_seen_at: new Date().toISOString() }, { merge: true });
        });

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("Instructor plan intro-seen error:", err);
        return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
    }
}
