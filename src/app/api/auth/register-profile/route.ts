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

        // Phone uniqueness check via Admin SDK
        if (phone) {
            const phoneSnap = await adminDb.collection("profiles").where("phone", "==", phone).limit(1).get();
            if (!phoneSnap.empty) {
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

        // Create profile document with create() - strictly fails if already exists
        await profileRef.create({
            id: uid,
            student_id: studentId,
            email: email,
            full_name: fullName || "",
            role: safeRole,
            phone: phone || "",
            parent_phone: parentPhone || null,
            grade_level: gradeLevel || null,
            specialty: specialty || null,
            bio: bio || null,
            status: "pending",
            wallet_balance: 0,
            active_devices: deviceId ? [deviceId] : [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });

        return NextResponse.json({ success: true, studentId });
    } catch (err: any) {
        console.error("register-profile error:", err);
        return NextResponse.json({ error: err.message || "Failed to register profile" }, { status: 500 });
    }
}
