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
