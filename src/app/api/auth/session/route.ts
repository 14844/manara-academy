import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(request: Request) {
    const { idToken, deviceId } = await request.json();

    if (!idToken) {
        return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        const uid = decoded.uid;

        // Verify account status from Firestore
        const profileRef = adminDb.collection("profiles").doc(uid);
        const profileSnap = await profileRef.get();
        if (profileSnap.exists) {
            const profile = profileSnap.data()!;
            if (profile.status === "pending") {
                return NextResponse.json({ error: "حسابك قيد المراجعة حالياً من قبل الإدارة" }, { status: 403 });
            }
            if (profile.status === "blocked" || profile.status === "suspended") {
                return NextResponse.json({ error: "تم إيقاف هذا الحساب. يرجى التواصل مع الإدارة" }, { status: 403 });
            }

            // Server-side device limit check for students
            if (profile.role !== "admin" && profile.role !== "instructor" && deviceId) {
                const activeDevices: string[] = profile.active_devices || [];
                const isKnown = activeDevices.includes(deviceId);

                if (!isKnown) {
                    if (activeDevices.length >= 2) {
                        return NextResponse.json({
                            error: "عذراً، لقد وصلت للحد الأقصى للأجهزة (جهازين فقط). يرجى التواصل مع إدارة الأكاديمية.",
                        }, { status: 403 });
                    }
                    await profileRef.update({
                        active_devices: FieldValue.arrayUnion(deviceId),
                        last_login: new Date().toISOString(),
                    });
                } else {
                    await profileRef.update({
                        last_login: new Date().toISOString(),
                    });
                }
            }
        }

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
    } catch (error) {
        console.error('Session API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE() {
    const cookieStore = await cookies();
    cookieStore.delete('session');
    return NextResponse.json({ status: 'success' });
}
