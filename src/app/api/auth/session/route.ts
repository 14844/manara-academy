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

        // Verify account status and handle device/session inside atomic transaction on profiles_private
        const profileRef = adminDb.collection("profiles").doc(uid);
        const profilePrivateRef = adminDb.collection("profiles_private").doc(uid);

        await adminDb.runTransaction(async (t) => {
            const [profileSnap, privateSnap] = await Promise.all([
                t.get(profileRef),
                t.get(profilePrivateRef),
            ]);
            if (!profileSnap.exists) return;

            const profile = profileSnap.data() || {};
            const priv = privateSnap.exists ? privateSnap.data() || {} : {};

            const status = priv.status || profile.status;
            if (status === "blocked" || status === "suspended" || status === "rejected") {
                throw new Error("STATUS_STOPPED");
            }

            const now = new Date().toISOString();
            const effectiveSessionId = sessionId || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            const updatePrivateData: any = {
                updated_at: now,
                active_session_id: effectiveSessionId,
            };

            // Server-side device limit check for students inside transaction
            if (profile.role !== "admin" && profile.role !== "instructor") {
                const activeDevices: string[] = priv.active_devices || profile.active_devices || [];
                const isKnown = activeDevices.includes(deviceId);

                if (!isKnown) {
                    if (activeDevices.length >= 2) {
                        throw new Error("DEVICE_LIMIT_REACHED");
                    }
                    updatePrivateData.active_devices = FieldValue.arrayUnion(deviceId);
                }
            }

            t.set(profilePrivateRef, updatePrivateData, { merge: true });
            t.update(profileRef, { last_login: now });
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

        const effectiveSessionId = sessionId || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        cookieStore.set('session_id', effectiveSessionId, {
            maxAge: expiresIn / 1000,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
        });

        return NextResponse.json({ status: 'success' });
    } catch (error: any) {
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
    cookieStore.delete('session_id');
    return NextResponse.json({ status: 'success' });
}
