import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requirePermission } from "@/lib/server-auth";
import { redactUserForRole } from "@/lib/user-redaction";

/**
 * GET /api/admin/users/[id]
 * Returns one user (public + private merged), redacted exactly like GET /api/admin/users.
 * Requires users.view.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await requirePermission(request, "users.view");
        if (!user) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { id } = await params;
        if (!id || typeof id !== "string" || id.includes("/") || id.length > 200) {
            return NextResponse.json({ error: "Missing userId" }, { status: 400 });
        }

        const [pubSnap, privSnap] = await Promise.all([
            adminDb.doc(`profiles/${id}`).get(),
            adminDb.doc(`profiles_private/${id}`).get(),
        ]);
        if (!pubSnap.exists && !privSnap.exists) {
            return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
        }

        const merged = { id, ...(pubSnap.data() || {}), ...(privSnap.data() || {}) };
        return NextResponse.json({ user: redactUserForRole(merged, user.role) });
    } catch {
        return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
    }
}
