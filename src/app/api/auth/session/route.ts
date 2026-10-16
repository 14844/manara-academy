import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(request: Request) {
    const { idToken, deviceId, sessionId } = await request.json();

    if (!idToken) {
        return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    if (!deviceId || typeof deviceId !== "string" || !deviceId.trim()) {
        return NextResponse.json({ error: "معرّف الجهاز مطلوب" }, { status: 400 });
    }

    try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        const uid = decoded.uid;

        // Verify account status and handle device/session inside atomic transaction
        const profileRef = adminDb.collection("profiles").doc(uid);

        await adminDb.runTransaction(async (t) => {
            const profileSnap = await t.get(profileRef);
            if (!profileSnap.exists) return;

            const profile = profileSnap.data()!;
            if (profile.status === "pending") {
                throw new Error("STATUS_PENDING");
            }
            if (profile.status === "blocked" || profile.status === "suspended" || profile.status === "rejected") {
                throw new Error("STATUS_STOPPED");
            }

            const updateData: any = {
                last_login: new Date().toISOString(),
            };
            if (sessionId) {
                updateData.active_session_id = sessionId;
            }

            // Server-side device limit check for students inside transaction
            if (profile.role !== "admin" && profile.role !== "instructor") {
                const activeDevices: string[] = profile.active_devices || [];
                const isKnown = activeDevices.includes(deviceId);

                if (!isKnown) {
                    if (activeDevices.length >= 2) {
                        throw new Error("DEVICE_LIMIT_REACHED");
                    }
                    updateData.active_devices = FieldValue.arrayUnion(deviceId);
                }
            }

            t.update(profileRef, updateData);
        });

        // Set session expiration to 5 days.
        const expiresIn = 60 * 60 * 24 * 5 * 1000;
        const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
        const cookieStore = await cookies();

        cookieStore.set('session', sessionCookie, {
            maxAge: expiresIn / 1000,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
        });

        return NextResponse.json({ status: 'success' });
    } catch (error: any) {
        if (error.message === "STATUS_PENDING") {
            return NextResponse.json({ error: "حسابك قيد المراجعة حالياً من قبل الإدارة" }, { status: 403 });
        }
        if (error.message === "STATUS_STOPPED") {
            return NextResponse.json({ error: "تم رفض أو إيقاف هذا الحساب. يرجى التواصل مع الإدارة" }, { status: 403 });
        }
        if (error.message === "DEVICE_LIMIT_REACHED") {
            return NextResponse.json({
                error: "عذراً، لقد وصلت للحد الأقصى للأجهزة (جهازين فقط). يرجى التواصل مع إدارة الأكاديمية.",
            }, { status: 403 });
        }
        console.error('Session API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE() {
    const cookieStore = await cookies();
    cookieStore.delete('session');
    return NextResponse.json({ status: 'success' });
}
