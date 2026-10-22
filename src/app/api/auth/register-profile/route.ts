import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export async function POST(request: Request) {
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

        // Check if profile document already exists (prevent resetting balance/role/status)
        const profileRef = adminDb.collection("profiles").doc(uid);
        const existingSnap = await profileRef.get();
        if (existingSnap.exists) {
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
            active_devices: deviceId ? [deviceId] : [],
            created_at: now,
            updated_at: now,
        });

        return NextResponse.json({ success: true, studentId });
    } catch (err: any) {
        console.error("register-profile error:", err);
        return NextResponse.json({ error: "فشل إنشاء الحساب. حاول مجدداً." }, { status: 500 });
    }
}
