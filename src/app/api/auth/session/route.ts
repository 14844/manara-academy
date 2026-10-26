import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import crypto from "crypto";
import { logServerActivity } from "@/lib/server-activity-logger";

export async function POST(request: Request) {
    const { idToken, deviceId } = await request.json();

    if (!idToken) {
        return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    if (!deviceId || typeof deviceId !== "string" || !deviceId.trim()) {
        return NextResponse.json({ error: "معرّف الجهاز مطلوب" }, { status: 400 });
    }

    try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        const uid = decoded.uid;

        // Item 4: Generate sessionId strictly on the server (never trust client)
        const effectiveSessionId = `${Date.now()}_${crypto.randomBytes(16).toString("hex")}`;

        // Generate server-side device fingerprint and server-bound device identifier
        const userAgent = request.headers.get("user-agent") || "";
        const acceptLanguage = request.headers.get("accept-language") || "";
        const deviceFingerprint = crypto
            .createHash("sha256")
            .update(`${userAgent}||${acceptLanguage}`)
            .digest("hex")
            .slice(0, 32);

        const boundDeviceId = crypto
            .createHash("sha256")
            .update(`${deviceId.trim()}::${deviceFingerprint}`)
            .digest("hex")
            .slice(0, 32);

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

            const status = priv.status || (profile.role === "admin" ? "active" : "pending");
            if (status === "blocked" || status === "suspended" || status === "rejected") {
                throw new Error("STATUS_STOPPED");
            }

            const now = new Date().toISOString();
            const updatePrivateData: any = {
                updated_at: now,
                active_session_id: effectiveSessionId,
                device_fingerprint: deviceFingerprint,
            };

            // Server-side device limit check for students inside transaction
            if (profile.role !== "admin" && profile.role !== "instructor") {
                const activeDevices: string[] = priv.active_devices || [];
                const isKnown = activeDevices.includes(boundDeviceId) || activeDevices.includes(deviceId.trim());

                if (!isKnown) {
                    if (activeDevices.length >= 2) {
                        throw new Error("DEVICE_LIMIT_REACHED");
                    }
                    updatePrivateData.active_devices = FieldValue.arrayUnion(boundDeviceId);
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

        cookieStore.set('session_id', effectiveSessionId, {
            maxAge: expiresIn / 1000,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
        });

        logServerActivity({
            action: "user_session_created",
            category: "auth",
            title: "إنشاء جلسة دخول موثقة",
            description: `تم إنشاء جلسة مصادقة بنجاح للمستخدم (${decoded.email || uid})`,
            status: "success",
            user_id: uid,
            user_email: decoded.email || "",
            user_name: decoded.name || decoded.email || "مستخدم",
            metadata: { device_id: deviceId.slice(0, 32) }
        }).catch(() => {});

        return NextResponse.json({ status: 'success', sessionId: effectiveSessionId });
    } catch (error: any) {
        if (error.message === "STATUS_STOPPED") {
            logServerActivity({
                action: "user_login_blocked",
                category: "auth",
                title: "محاولة دخول حساب موقوف",
                description: `محاولة دخول فاشلة لحساب موقف أو معلق`,
                status: "failed",
                error_message: "الحساب موقوف أو معلق",
            }).catch(() => {});
            return NextResponse.json({ error: "تم رفض أو إيقاف هذا الحساب. يرجى التواصل مع الإدارة" }, { status: 403 });
        }
        if (error.message === "DEVICE_LIMIT_REACHED") {
            logServerActivity({
                action: "user_device_limit_exceeded",
                category: "auth",
                title: "تجاوز الحد الأقصى للأجهزة",
                description: `محاولة تسجيل دخول من جهاز ثالث (الحد المسموح جهازان)`,
                status: "failed",
                error_message: "تجاوز حد الأجهزة المصرح بها",
            }).catch(() => {});
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

    logServerActivity({
        action: "user_logout",
        category: "auth",
        title: "تسجيل خروج مستخدم",
        description: "قام المستخدم بتسجيل الخروج وإنهاء جلسته",
        status: "info",
    }).catch(() => {});

    return NextResponse.json({ status: 'success' });
}
