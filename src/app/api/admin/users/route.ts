import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getServerAuth } from "@/lib/server-auth";

/**
 * GET /api/admin/users
 * Returns all user profiles (public + private merged) for admin only.
 */
export async function GET(request: Request) {
    try {
        const user = await getServerAuth(request);
        if (!user || user.role !== "admin") {
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
            return { id: doc.id, ...pub, ...priv };
        });

        return NextResponse.json({ users });
    } catch {
        return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
    }
}

/**
 * POST /api/admin/users
 * Allows admin to update status or reset devices for a user in profiles_private.
 */
export async function POST(request: Request) {
    try {
        const user = await getServerAuth(request);
        if (!user || user.role !== "admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const { userId, action, status } = body;

        if (!userId) {
            return NextResponse.json({ error: "Missing userId" }, { status: 400 });
        }

        const now = new Date().toISOString();

        if (action === "update_status") {
            if (!status) {
                return NextResponse.json({ error: "Missing status" }, { status: 400 });
            }
            await adminDb.doc(`profiles_private/${userId}`).set({
                status,
                updated_at: now,
            }, { merge: true });

            return NextResponse.json({ success: true });
        }

        if (action === "reset_devices") {
            await adminDb.doc(`profiles_private/${userId}`).set({
                active_devices: [],
                active_session_id: null,
                updated_at: now,
            }, { merge: true });

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (err: any) {
        console.error("Admin user action error:", err);
        return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
    }
}
