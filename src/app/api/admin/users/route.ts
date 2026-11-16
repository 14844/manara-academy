import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { activityLogRole, getServerAuth, isAccountActive, requirePermission } from "@/lib/server-auth";
import { logServerActivity } from "@/lib/server-activity-logger";
import { hasPermission, isBackofficeRole, type Permission, type UserRole } from "@/lib/permissions";

/** Contact fields only visible with users.view_contact. */
const CONTACT_FIELDS = ["email", "phone", "parent_phone"];
/** Money fields only visible with wallet.view. */
const MONEY_FIELDS = ["wallet_balance", "total_earned", "total_spent", "total_withdrawn", "pending_balance", "balance", "earnings"];
// Whole snake_case words only (e.g. total_earned, pending_balance) so names like "learning_goal" are not caught
const MONEY_FIELD_PATTERN = /(^|_)(balance|earned|earnings?|spent|withdrawn|revenue|payouts?)(_|$)/i;
/** Session / device binding secrets — admin only. */
const SESSION_FIELDS = ["active_session_id", "device_fingerprint"];

/** Account statuses a non-admin staff member may set. */
const STAFF_ALLOWED_STATUSES = ["approved", "active", "pending", "rejected", "suspended", "blocked"];

function redactUserForRole(userDoc: Record<string, any>, role: UserRole): Record<string, any> {
    // Admin gets the exact same payload as before.
    if (role === "admin") return userDoc;

    const out: Record<string, any> = { ...userDoc };
    if (!hasPermission(role, "users.view_contact")) {
        for (const f of CONTACT_FIELDS) delete out[f];
    }
    if (!hasPermission(role, "wallet.view")) {
        for (const key of Object.keys(out)) {
            if (MONEY_FIELDS.includes(key) || MONEY_FIELD_PATTERN.test(key)) delete out[key];
        }
    }
    for (const f of SESSION_FIELDS) delete out[f];
    return out;
}

/**
 * GET /api/admin/users
 * Returns all user profiles (public + private merged). Requires users.view;
 * sensitive fields are stripped according to the caller's permissions (admin sees everything).
 */
export async function GET(request: Request) {
    try {
        const user = await requirePermission(request, "users.view");
        if (!user) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const [publicSnap, privateSnap] = await Promise.all([
            adminDb.collection("profiles").orderBy("created_at", "desc").get(),
            adminDb.collection("profiles_private").get(),
        ]);

        // Build a map of private data keyed by uid
        const privateMap = new Map<string, FirebaseFirestore.DocumentData>();
        privateSnap.docs.forEach((doc) => {
            privateMap.set(doc.id, doc.data());
        });

        const users = publicSnap.docs.map((doc) => {
            const pub = doc.data();
            const priv = privateMap.get(doc.id) || {};
            return redactUserForRole({ id: doc.id, ...pub, ...priv }, user.role);
        });

        return NextResponse.json({ users });
    } catch {
        return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
    }
}

/**
 * POST /api/admin/users
 * Account actions on a user:
 *  - update_status / reset_devices  → users.manage_status
 *  - set_verified / set_auto_report → users.verify
 * Non-admin staff can never act on admin or staff accounts.
 */
export async function POST(request: Request) {
    try {
        const user = await getServerAuth(request);
        if (
            !user ||
            !isAccountActive(user) ||
            !(hasPermission(user.role, "users.manage_status") || hasPermission(user.role, "users.verify"))
        ) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const { userId, action, status, value } = body || {};

        if (!userId || typeof userId !== "string" || userId.includes("/")) {
            return NextResponse.json({ error: "Missing userId" }, { status: 400 });
        }

        let requiredPermission: Permission;
        if (action === "update_status" || action === "reset_devices") {
            requiredPermission = "users.manage_status";
        } else if (action === "set_verified" || action === "set_auto_report") {
            requiredPermission = "users.verify";
        } else {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        if (!hasPermission(user.role, requiredPermission)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const isAdmin = user.role === "admin";

        // Staff may only act on regular accounts (students / instructors), never on admin or staff.
        if (!isAdmin) {
            const targetSnap = await adminDb.doc(`profiles/${userId}`).get();
            if (!targetSnap.exists) {
                return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
            }
            if (isBackofficeRole(targetSnap.data()?.role)) {
                return NextResponse.json({ error: "غير مصرح لك بتعديل حسابات الإدارة أو فريق العمل" }, { status: 403 });
            }
        }

        const now = new Date().toISOString();
        const actorName = user.profile?.full_name || user.email || "مسؤول المنصة";
        const actorRole = activityLogRole(user);

        if (action === "update_status") {
            if (!status) {
                return NextResponse.json({ error: "Missing status" }, { status: 400 });
            }
            if (!isAdmin && (typeof status !== "string" || !STAFF_ALLOWED_STATUSES.includes(status))) {
                return NextResponse.json({ error: "Invalid status" }, { status: 400 });
            }
            await adminDb.doc(`profiles_private/${userId}`).set({
                status,
                updated_at: now,
            }, { merge: true });

            await logServerActivity({
                action: "admin_user_status_updated",
                category: "admin_action",
                title: `تحديث حالة مستخدم إلى (${status})`,
                description: `قام المسؤول بتعديل حالة حساب المستخدم (${userId}) إلى "${status}"`,
                status: "success",
                user_id: user.uid,
                user_name: actorName,
                user_email: user.email || "",
                user_role: actorRole,
                target_user_id: userId,
                metadata: { target_user_id: userId, new_status: status }
            }).catch(() => {});

            return NextResponse.json({ success: true });
        }

        if (action === "reset_devices") {
            await adminDb.doc(`profiles_private/${userId}`).set({
                active_devices: [],
                active_session_id: null,
                updated_at: now,
            }, { merge: true });

            await logServerActivity({
                action: "admin_reset_user_devices",
                category: "admin_action",
                title: "تصفير أجهزة المستخدم النشطة",
                description: `قام المسؤول بتصفير جلسات وأجهزة المستخدم النشطة (${userId})`,
                status: "success",
                user_id: user.uid,
                user_name: actorName,
                user_email: user.email || "",
                user_role: actorRole,
                target_user_id: userId,
                metadata: { target_user_id: userId }
            }).catch(() => {});

            return NextResponse.json({ success: true });
        }

        // set_verified / set_auto_report
        if (typeof value !== "boolean") {
            return NextResponse.json({ error: "Missing or invalid value" }, { status: 400 });
        }

        const field = action === "set_verified" ? "is_verified" : "auto_report_unlocked";
        try {
            await adminDb.doc(`profiles/${userId}`).update({
                [field]: value,
                updated_at: now,
            });
        } catch (err: any) {
            // Firestore NOT_FOUND
            if (err?.code === 5 || String(err?.message || "").includes("NOT_FOUND")) {
                return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
            }
            throw err;
        }

        const isVerify = action === "set_verified";
        await logServerActivity({
            action: isVerify ? "admin_user_verified_updated" : "admin_user_auto_report_updated",
            category: "admin_action",
            title: isVerify
                ? (value ? "توثيق حساب مدرس" : "إلغاء توثيق حساب مدرس")
                : (value ? "تفعيل الجدولة التلقائية للتقارير" : "قفل الجدولة التلقائية للتقارير"),
            description: isVerify
                ? `قام المسؤول ${value ? "بتوثيق" : "بإلغاء توثيق"} حساب المستخدم (${userId})`
                : `قام المسؤول ${value ? "بتفعيل" : "بقفل"} الجدولة التلقائية للتقارير للمستخدم (${userId})`,
            status: "success",
            user_id: user.uid,
            user_name: actorName,
            user_email: user.email || "",
            user_role: actorRole,
            target_user_id: userId,
            metadata: { target_user_id: userId, [field]: value }
        }).catch(() => {});

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("Admin user action error:", err);
        return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
    }
}
