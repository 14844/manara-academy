import { NextResponse } from "next/server";
import { getServerAuth, logActor } from "@/lib/server-auth";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { isStaffRole } from "@/lib/permissions";
import { errorText, logServerActivity } from "@/lib/server-activity-logger";

/** Avatar must live in platform storage (same allowlist as PUT /api/profile/me). */
function isAllowedAvatarUrl(avatarUrl: string): boolean {
    if (avatarUrl.startsWith("avatars/") || avatarUrl.startsWith("/api/storage/")) return true;
    try {
        if (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://")) {
            const hostname = new URL(avatarUrl).hostname.toLowerCase();
            return (
                hostname.endsWith(".supabase.co") ||
                hostname === "manara-academy.b-cdn.net" ||
                hostname === "storage.bunnycdn.com"
            );
        }
    } catch {
        return false;
    }
    return false;
}

export async function POST(request: Request) {
    const user = await getServerAuth(request);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentStatus = user.status;
    if (currentStatus === "blocked" || currentStatus === "suspended" || currentStatus === "rejected") {
        return NextResponse.json({ error: "الحساب موقوف أو مرفوض، لا يمكن تحديث الحالة" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { action, profile } = body;
        const profileRef = adminDb.collection("profiles").doc(user.uid);

        if (action === "email_verified") {
            // Verify from Firebase Auth directly
            const authUser = await adminAuth.getUser(user.uid);
            if (!authUser.emailVerified) {
                return NextResponse.json({ error: "البريد الإلكتروني لم يتم تأكيده بعد" }, { status: 400 });
            }

            const privateRef = adminDb.collection("profiles_private").doc(user.uid);
            // Staff accounts are approved by the owner; never downgrade them to pending (would lock them out of /admin APIs)
            await privateRef.set({
                ...(isStaffRole(user.role) ? {} : { status: "pending" }),
                updated_at: new Date().toISOString(),
            }, { merge: true });

            await logServerActivity({
                action: "user_email_verified",
                category: "auth",
                title: "تأكيد البريد الإلكتروني",
                description: `قام ${user.profile?.full_name || user.email} بتأكيد بريده الإلكتروني`,
                status: "success",
                ...logActor(user),
            }, request);
            return NextResponse.json({ success: true });
        }

        if (action === "update_profile") {
            // Same policy as PUT /api/profile/me: personal data is locked for non-admins (only the avatar may change).
            const personalFields = ["full_name", "grade_level", "specialty", "bio", "phone", "parent_phone"];
            const p: Record<string, any> = profile && typeof profile === "object" && !Array.isArray(profile) ? profile : {};
            const requestedPersonal = personalFields.filter((k) => p[k] !== undefined);

            if (user.role !== "admin" && requestedPersonal.length > 0) {
                await logServerActivity({
                    action: "profile_update_denied",
                    category: "security",
                    title: "محاولة تعديل بيانات شخصية مرفوضة",
                    description: `حاول ${user.profile?.full_name || user.email} تعديل بياناته الشخصية الموثقة (غير مسموح إلا للإدارة)`,
                    status: "failed",
                    ...logActor(user),
                    metadata: { fields: requestedPersonal, via: "update-status" },
                }, request);
                return NextResponse.json({
                    error: "البيانات الشخصية للقراءة فقط وموثقة في المنصة. لتعديلها يرجى التواصل مع الإدارة. يُسمح فقط بتغيير الصورة الشخصية."
                }, { status: 403 });
            }

            const now = new Date().toISOString();
            const publicUpdate: Record<string, any> = { updated_at: now };
            const privateUpdate: Record<string, any> = { updated_at: now };

            if (p.full_name !== undefined) {
                if (typeof p.full_name !== "string" || p.full_name.trim().length < 2 || p.full_name.trim().length > 70) {
                    return NextResponse.json({ error: "الاسم بالكامل يجب أن يكون بين حرفين و 70 حرفاً" }, { status: 400 });
                }
                publicUpdate.full_name = p.full_name.trim();
            }
            if (p.grade_level !== undefined) {
                publicUpdate.grade_level = typeof p.grade_level === "string" && p.grade_level.trim() ? p.grade_level.slice(0, 50).trim() : null;
            }
            if (p.specialty !== undefined) {
                publicUpdate.specialty = typeof p.specialty === "string" ? p.specialty.slice(0, 100).trim() : "";
            }
            if (p.bio !== undefined) {
                publicUpdate.bio = typeof p.bio === "string" ? p.bio.slice(0, 500).trim() : "";
            }

            if (p.avatar_url !== undefined) {
                const avatarUrl = p.avatar_url;
                if (avatarUrl === "" || avatarUrl === null) {
                    publicUpdate.avatar_url = "";
                } else {
                    if (typeof avatarUrl !== "string" || avatarUrl.length > 500) {
                        return NextResponse.json({ error: "رابط الصورة غير صالح" }, { status: 400 });
                    }
                    if (!isAllowedAvatarUrl(avatarUrl)) {
                        return NextResponse.json({ error: "رابط الصورة الرمزية يجب أن يكون من مساحة تخزين المنصة فقط" }, { status: 400 });
                    }
                    publicUpdate.avatar_url = avatarUrl.trim();
                }
            }

            for (const key of ["phone", "parent_phone"] as const) {
                if (p[key] === undefined) continue;
                const val = p[key];
                if (val !== null && val !== "" && (typeof val !== "string" || val.trim().length > 30)) {
                    return NextResponse.json({ error: "رقم الهاتف غير صالح" }, { status: 400 });
                }
                privateUpdate[key] = typeof val === "string" ? val.trim() : "";
            }

            // Phone uniqueness (same check as registration), excluding this user's own documents
            if (privateUpdate.phone) {
                const [phoneSnap, privPhoneSnap] = await Promise.all([
                    adminDb.collection("profiles").where("phone", "==", privateUpdate.phone).limit(2).get(),
                    adminDb.collection("profiles_private").where("phone", "==", privateUpdate.phone).limit(2).get(),
                ]);
                const takenByOther = [...phoneSnap.docs, ...privPhoneSnap.docs].some((d) => d.id !== user.uid);
                if (takenByOther) {
                    return NextResponse.json({ error: "رقم الهاتف هذا مسجل بالفعل بحساب آخر" }, { status: 400 });
                }
            }

            // Personal-data changes send non-staff accounts back to review (only reachable by admins now)
            if (requestedPersonal.length > 0 && !isStaffRole(user.role)) {
                privateUpdate.status = "pending";
            }

            const privateRef = adminDb.collection("profiles_private").doc(user.uid);
            await Promise.all([
                profileRef.update(publicUpdate),
                privateRef.set(privateUpdate, { merge: true }),
            ]);
            await logServerActivity({
                action: "profile_updated",
                category: "client",
                title: "تحديث بيانات الملف الشخصي",
                description: `قام ${user.profile?.full_name || user.email} بتحديث بياناته (${[...Object.keys(publicUpdate), ...Object.keys(privateUpdate)].filter(k => k !== "updated_at" && k !== "status").join("، ") || "بدون حقول"})${privateUpdate.status === "pending" ? " — الحساب عاد لحالة المراجعة" : ""}`,
                status: "success",
                ...logActor(user),
                metadata: { fields: [...Object.keys(publicUpdate), ...Object.keys(privateUpdate)].filter(k => k !== "updated_at") },
            }, request);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "إجراء غير صالح" }, { status: 400 });
    } catch (err: any) {
        console.error("Profile status update error:", err);
        await logServerActivity({
            action: "profile_update_failed",
            category: "client",
            title: "فشل تحديث الملف الشخصي",
            description: `فشل تحديث بيانات/حالة حساب ${user.profile?.full_name || user.email}`,
            status: "failed",
            ...logActor(user),
            error_message: errorText(err),
        }, request);
        return NextResponse.json({ error: "فشل تحديث حالة الحساب" }, { status: 500 });
    }
}
