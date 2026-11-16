import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { activityLogRole, getServerAuth, isAccountActive, requirePermission, type ServerUser } from "@/lib/server-auth";
import { logServerActivity } from "@/lib/server-activity-logger";
import { getRoleLabel, hasPermission, isBackofficeRole, STAFF_ROLES, type Permission, type UserRole } from "@/lib/permissions";
// Redaction lives in a lib module: Next.js route files may only export HTTP handlers / route config.
import { redactUserForRole } from "@/lib/user-redaction";

/** Account statuses a non-admin staff member may set. */
const STAFF_ALLOWED_STATUSES = ["approved", "active", "pending", "rejected", "suspended", "blocked"];

/** Every role an admin may assign with set_role. */
const ASSIGNABLE_ROLES: readonly UserRole[] = ["student", "instructor", "admin", ...STAFF_ROLES];

class RoleChangeError extends Error {
    constructor(message: string, public httpStatus: number) {
        super(message);
    }
}

/**
 * set_role: change a user's role (users.manage_roles — admin only).
 *  - cannot change your own role
 *  - cannot demote the last remaining admin
 *  - backoffice role + pending/missing status → status "active"
 *  - revokes refresh tokens & clears active_session_id so the new role applies on next login
 * Note: the platform does not use Firebase custom claims for roles (profiles/{uid}.role is the source of truth).
 */
async function handleSetRole(user: ServerUser, userId: string, newRole: unknown) {
    if (typeof newRole !== "string" || !(ASSIGNABLE_ROLES as readonly string[]).includes(newRole)) {
        return NextResponse.json({ error: "دور غير صالح" }, { status: 400 });
    }
    if (userId === user.uid) {
        return NextResponse.json({ error: "لا يمكنك تغيير دورك بنفسك" }, { status: 400 });
    }
    const role = newRole as UserRole;
    const profileRef = adminDb.doc(`profiles/${userId}`);
    const privateRef = adminDb.doc(`profiles_private/${userId}`);
    const now = new Date().toISOString();

    let oldRole: UserRole = "student";
    let targetName = "";
    let statusChangedTo: string | null = null;
    try {
        await adminDb.runTransaction(async (t) => {
            const [profileSnap, privateSnap] = await Promise.all([t.get(profileRef), t.get(privateRef)]);
            if (!profileSnap.exists) {
                throw new RoleChangeError("المستخدم غير موجود", 404);
            }
            const profile = profileSnap.data() || {};
            const priv = privateSnap.exists ? privateSnap.data() || {} : {};
            oldRole = ((profile.role as UserRole) || "student");
            targetName = profile.full_name || priv.email || userId;
            statusChangedTo = null;

            if (oldRole === role) return;

            if (oldRole === "admin" && role !== "admin") {
                const adminsSnap = await t.get(adminDb.collection("profiles").where("role", "==", "admin"));
                if (adminsSnap.size <= 1) {
                    throw new RoleChangeError("لا يمكن إزالة آخر مدير للمنصة", 400);
                }
            }

            const currentStatus = typeof priv.status === "string" ? priv.status : "";
            const privateUpdate: Record<string, any> = { active_session_id: null, updated_at: now };
            if (isBackofficeRole(role) && (!currentStatus || currentStatus === "pending")) {
                privateUpdate.status = "active";
                statusChangedTo = "active";
            } else if (!isBackofficeRole(role) && !currentStatus && isBackofficeRole(oldRole)) {
                // Staff had no stored status (implicitly active) — keep them able to log in as a regular user.
                privateUpdate.status = "approved";
                statusChangedTo = "approved";
            }

            t.update(profileRef, { role, updated_at: now });
            t.set(privateRef, privateUpdate, { merge: true });
        });
    } catch (err) {
        if (err instanceof RoleChangeError) {
            return NextResponse.json({ error: err.message }, { status: err.httpStatus });
        }
        throw err;
    }

    if (oldRole === role) {
        return NextResponse.json({ success: true, role, unchanged: true });
    }

    // Force re-login so the new role (and its permissions) is picked up everywhere.
    await adminAuth.revokeRefreshTokens(userId).catch((e) => {
        console.error("revokeRefreshTokens failed:", e);
    });

    const actorName = user.profile?.full_name || user.email || "مسؤول المنصة";
    await logServerActivity({
        action: "user_role_changed",
        category: "admin_action",
        title: `تغيير دور مستخدم إلى (${getRoleLabel(role)})`,
        description: `قام ${getRoleLabel(user.role)} "${actorName}" بتغيير دور "${targetName}" من ${getRoleLabel(oldRole)} إلى ${getRoleLabel(role)}`,
        status: "success",
        user_id: user.uid,
        user_name: actorName,
        user_email: user.email || "",
        user_role: activityLogRole(user),
        target_user_id: userId,
        target_user_name: targetName,
        metadata: { target_user_id: userId, old_role: oldRole, new_role: role, status_changed_to: statusChangedTo },
    }).catch(() => {});

    return NextResponse.json({ success: true, role, old_role: oldRole, status: statusChangedTo });
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
            !(
                hasPermission(user.role, "users.manage_status") ||
                hasPermission(user.role, "users.verify") ||
                hasPermission(user.role, "users.manage_roles")
            )
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
        } else if (action === "set_role") {
            requiredPermission = "users.manage_roles";
        } else {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        if (!hasPermission(user.role, requiredPermission)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (action === "set_role") {
            return await handleSetRole(user, userId, body?.role);
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
