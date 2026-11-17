import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { DEFAULT_PLAN_ID } from "@/lib/plans";
import { computeDeviceBinding } from "@/lib/device-binding";
import { errorText, logServerActivity } from "@/lib/server-activity-logger";

export async function POST(request: Request) {
    let actorUid = "guest";
    let actorEmail = "";
    let actorName = "زائر";
    try {
        const body = await request.json();
        const {
            idToken,
            fullName,
            role: requestedRole,
            phone,
            parentPhone,
            gradeLevel,
            specialty,
            bio,
            deviceId,
        } = body;

        if (!idToken) {
            return NextResponse.json({ error: "Missing authentication token" }, { status: 401 });
        }

        // Verify Firebase ID Token
        const decoded = await adminAuth.verifyIdToken(idToken);
        const uid = decoded.uid;
        const email = decoded.email || "";
        actorUid = uid;
        actorEmail = email;
        actorName = (typeof fullName === "string" && fullName.slice(0, 100)) || email || uid;
        const logFail = (reason: string) => logServerActivity({
            action: "user_signup_failed",
            category: "auth",
            title: "فشل إنشاء حساب جديد",
            description: `فشل تسجيل حساب ${actorName} (${email || uid}): ${reason}`,
            status: "failed",
            user_id: uid,
            user_name: actorName,
            user_email: email,
            user_role: "guest",
            error_message: reason,
        }, request);

        // Check if profile document already exists (prevent resetting balance/role/status)
        const profileRef = adminDb.collection("profiles").doc(uid);
        const existingSnap = await profileRef.get();
        if (existingSnap.exists) {
            await logFail("الحساب مسجل بالفعل مسبقاً");
            return NextResponse.json({ error: "الحساب مسجل بالفعل مسبقاً" }, { status: 409 });
        }

        // Phone uniqueness check via Admin SDK across both profiles and profiles_private
        if (phone) {
            const [phoneSnap, privPhoneSnap] = await Promise.all([
                adminDb.collection("profiles").where("phone", "==", phone).limit(1).get(),
                adminDb.collection("profiles_private").where("phone", "==", phone).limit(1).get(),
            ]);
            if (!phoneSnap.empty || !privPhoneSnap.empty) {
                // Delete orphaned auth user
                await adminAuth.deleteUser(uid).catch(() => {});
                await logFail("رقم الهاتف مسجل بالفعل بحساب آخر");
                return NextResponse.json({ error: "رقم الهاتف هذا مسجل بالفعل بحساب آخر" }, { status: 400 });
            }
        }

        // Enforce strict roles on server: only "student" or "instructor" (never "admin")
        const safeRole = requestedRole === "instructor" ? "instructor" : "student";

        // Generate unique student ID transactionally with Admin SDK
        const statsRef = adminDb.collection("system").doc("stats");
        const studentId = await adminDb.runTransaction(async (t) => {
            const statsSnap = await t.get(statsRef);
            let nextId = 1001;
            if (statsSnap.exists) {
                nextId = (statsSnap.data()?.last_student_number || 1000) + 1;
            }
            t.set(statsRef, { last_student_number: nextId }, { merge: true });
            return `MANARA-${nextId}`;
        });

        const now = new Date().toISOString();

        // Create PUBLIC profile (non-sensitive fields only)
        await profileRef.create({
            id: uid,
            full_name: fullName || "",
            role: safeRole,
            grade_level: gradeLevel || null,
            specialty: specialty || null,
            bio: bio || null,
            avatar_url: null,
            is_verified: false,
            created_at: now,
            updated_at: now,
        });

        // Create PRIVATE profile (sensitive fields)
        const privateRef = adminDb.collection("profiles_private").doc(uid);
        await privateRef.create({
            email: email,
            phone: phone || "",
            parent_phone: parentPhone || null,
            student_id: studentId,
            status: "pending",
            wallet_balance: 0,
            // Store only the server-bound device id (same binding as /api/auth/session), never the raw client id
            active_devices: typeof deviceId === "string" && deviceId.trim()
                ? [computeDeviceBinding(request, deviceId).boundDeviceId]
                : [],
            // Every instructor starts on البداية (starter). A missing plan_id is also read as starter.
            ...(safeRole === "instructor" ? { plan_id: DEFAULT_PLAN_ID, plan_expires_at: null } : {}),
            created_at: now,
            updated_at: now,
        });

        await logServerActivity({
            action: "user_signup",
            category: "auth",
            title: safeRole === "instructor" ? "تسجيل مدرس جديد" : "تسجيل طالب جديد",
            description: `تم إنشاء حساب جديد (${safeRole === "instructor" ? "مدرس" : "طالب"}) باسم ${actorName} (${email || uid}) برقم ${studentId} — بانتظار المراجعة`,
            status: "success",
            user_id: uid,
            user_name: actorName,
            user_email: email,
            user_role: safeRole,
            metadata: { student_id: studentId, role: safeRole },
        }, request);

        return NextResponse.json({ success: true, studentId });
    } catch (err: any) {
        console.error("register-profile error:", err);
        await logServerActivity({
            action: "user_signup_failed",
            category: "auth",
            title: "فشل إنشاء حساب جديد",
            description: `خطأ أثناء إنشاء الحساب ${actorName}${actorEmail ? ` (${actorEmail})` : ""}`,
            status: "failed",
            user_id: actorUid,
            user_name: actorName,
            user_email: actorEmail,
            user_role: "guest",
            error_message: errorText(err),
        }, request);
        return NextResponse.json({ error: "فشل إنشاء الحساب. حاول مجدداً." }, { status: 500 });
    }
}
