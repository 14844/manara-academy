import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import crypto from "crypto";
import { errorText, logServerActivity } from "@/lib/server-activity-logger";
import { isBackofficeRole } from "@/lib/permissions";
import { getServerAuth, logActor } from "@/lib/server-auth";
import { computeDeviceBinding } from "@/lib/device-binding";
import type { ActivityLogInput } from "@/lib/activity-logger";

export async function POST(request: Request) {
    let body: any = {};
    try {
        body = await request.json();
    } catch {
        body = {};
    }
    const { idToken, deviceId } = body || {};

    if (!idToken) {
        return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    if (!deviceId || typeof deviceId !== "string" || !deviceId.trim()) {
        return NextResponse.json({ error: "معرّف الجهاز مطلوب" }, { status: 400 });
    }

    // Identity of the person logging in (filled as soon as the token is verified) for audit logs
    let actor: Pick<ActivityLogInput, "user_id" | "user_name" | "user_email" | "user_role"> = {
        user_id: "guest",
        user_name: "زائر",
        user_role: "guest",
    };

    try {
        let decoded;
        try {
            decoded = await adminAuth.verifyIdToken(idToken);
        } catch (err) {
            await logServerActivity({
                action: "user_login_failed",
                category: "auth",
                title: "فشل تسجيل الدخول",
                description: "محاولة إنشاء جلسة دخول برمز مصادقة غير صالح أو منتهي",
                status: "failed",
                ...actor,
                error_message: errorText(err),
            }, request);
            return NextResponse.json({ error: "رمز المصادقة غير صالح" }, { status: 401 });
        }
        const uid = decoded.uid;
        actor = {
            user_id: uid,
            user_email: decoded.email || "",
            user_name: decoded.name || decoded.email || uid,
            user_role: "student",
        };

        // Item 4: Generate sessionId strictly on the server (never trust client)
        const effectiveSessionId = `${Date.now()}_${crypto.randomBytes(16).toString("hex")}`;

        // Generate server-side device fingerprint and server-bound device identifier
        const { deviceFingerprint, boundDeviceId } = computeDeviceBinding(request, deviceId);

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
            actor = {
                ...actor,
                user_name: profile.full_name || actor.user_name,
                user_role: (profile.role || "student") as ActivityLogInput["user_role"],
            };

            // Admin and staff (backoffice) roles default to "active"; explicit blocked/suspended/rejected still stops them.
            const status = priv.status || (isBackofficeRole(profile.role) ? "active" : "pending");
            if (status === "blocked" || status === "suspended" || status === "rejected") {
                throw new Error("STATUS_STOPPED");
            }

            const now = new Date().toISOString();
            const updatePrivateData: any = {
                updated_at: now,
                active_session_id: effectiveSessionId,
                device_fingerprint: deviceFingerprint,
            };

            // Server-side device limit check for students inside transaction (skipped for instructors, admin & staff)
            if (!isBackofficeRole(profile.role) && profile.role !== "instructor") {
                const activeDevices: string[] = priv.active_devices || [];
                // Only the server-bound id is accepted (raw client ids are never stored or trusted)
                const isKnown = activeDevices.includes(boundDeviceId);

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

        await logServerActivity({
            action: "user_login_success",
            category: "auth",
            title: "تسجيل دخول ناجح",
            description: `تم تسجيل دخول ${actor.user_name} (${decoded.email || uid}) وإنشاء جلسة جديدة`,
            status: "success",
            ...actor,
            metadata: { device_id: deviceId.slice(0, 32), bound_device_id: boundDeviceId, session_id_prefix: effectiveSessionId.slice(0, 13) }
        }, request);

        return NextResponse.json({ status: 'success', sessionId: effectiveSessionId });
    } catch (error: any) {
        if (error.message === "STATUS_STOPPED") {
            await logServerActivity({
                action: "user_login_blocked",
                category: "auth",
                title: "محاولة دخول حساب موقوف",
                description: `محاولة دخول مرفوضة لحساب موقوف أو محظور أو مرفوض: ${actor.user_name} (${actor.user_email || actor.user_id})`,
                status: "failed",
                ...actor,
                error_message: "الحساب موقوف أو معلق",
            }, request);
            return NextResponse.json({ error: "تم رفض أو إيقاف هذا الحساب. يرجى التواصل مع الإدارة" }, { status: 403 });
        }
        if (error.message === "DEVICE_LIMIT_REACHED") {
            await logServerActivity({
                action: "user_device_limit_exceeded",
                category: "auth",
                title: "تجاوز الحد الأقصى للأجهزة",
                description: `محاولة تسجيل دخول ${actor.user_name} (${actor.user_email || actor.user_id}) من جهاز ثالث (الحد المسموح جهازان)`,
                status: "failed",
                ...actor,
                error_message: "تجاوز حد الأجهزة المصرح بها",
                metadata: { device_id: String(deviceId).slice(0, 32) },
            }, request);
            return NextResponse.json({
                error: "عذراً، لقد وصلت للحد الأقصى للأجهزة (جهازين فقط). يرجى التواصل مع إدارة الأكاديمية.",
            }, { status: 403 });
        }
        console.error('Session API Error:', error);
        await logServerActivity({
            action: "user_login_failed",
            category: "auth",
            title: "فشل تسجيل الدخول",
            description: `خطأ أثناء إنشاء جلسة الدخول لـ ${actor.user_name} (${actor.user_email || actor.user_id})`,
            status: "failed",
            ...actor,
            error_message: errorText(error),
        }, request);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    // Resolve who is logging out BEFORE the cookies are removed
    const user = await getServerAuth(request).catch(() => null);

    const cookieStore = await cookies();
    cookieStore.delete('session');
    cookieStore.delete('session_id');

    await logServerActivity({
        action: "user_logout",
        category: "auth",
        title: "تسجيل خروج مستخدم",
        description: user
            ? `قام ${user.profile?.full_name || user.email || user.uid} بتسجيل الخروج وإنهاء جلسته`
            : "تسجيل خروج لجلسة غير معروفة أو منتهية",
        status: "info",
        ...(user ? logActor(user) : { user_id: "guest", user_name: "زائر", user_role: "guest" as const }),
    }, request);

    return NextResponse.json({ status: 'success' });
}
