import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requirePermission } from "@/lib/server-auth";
import { FALLBACK_SCAN_LIMIT, isMissingIndexError, logTime } from "../team-utils";

const PAGE_SIZE = 50;
const CATEGORIES = ["financial", "auth", "admin_action", "course", "system", "client", "ai_support"];

function parseDateParam(value: string | null, endOfDay: boolean): number | null {
    if (!value) return null;
    // Accept YYYY-MM-DD (from <input type="date">) or any ISO / epoch value.
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const ts = /^\d+$/.test(value)
        ? Number(value)
        : Date.parse(isDateOnly ? `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}` : value);
    return Number.isFinite(ts) ? ts : null;
}

/**
 * GET /api/admin/team/activity?userId=...&cursor=...&category=...&from=YYYY-MM-DD&to=YYYY-MM-DD
 * A team member's activity timeline, newest first, 50 per page (team.view — admin only).
 * `cursor` is the id of the last log of the previous page; the response returns `nextCursor`.
 */
export async function GET(request: Request) {
    try {
        const user = await requirePermission(request, "team.view");
        if (!user) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const url = new URL(request.url);
        const userId = url.searchParams.get("userId");
        const cursor = url.searchParams.get("cursor");
        const categoryParam = url.searchParams.get("category");
        const category = categoryParam && CATEGORIES.includes(categoryParam) ? categoryParam : null;
        const from = parseDateParam(url.searchParams.get("from"), false);
        const to = parseDateParam(url.searchParams.get("to"), true);

        if (!userId || userId.includes("/")) {
            return NextResponse.json({ error: "Missing userId" }, { status: 400 });
        }
        if (cursor && cursor.includes("/")) {
            return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
        }

        const toLog = (id: string, data: Record<string, any>) => ({
            id,
            ...data,
            created_at: data.created_at || new Date(logTime(data)).toISOString(),
        });

        try {
            // Needs composite indexes on activity_logs: (user_id, timestamp desc)
            // and (user_id, category, timestamp desc) when filtering by category.
            let q: FirebaseFirestore.Query = adminDb.collection("activity_logs").where("user_id", "==", userId);
            if (category) q = q.where("category", "==", category);
            if (from !== null) q = q.where("timestamp", ">=", from);
            if (to !== null) q = q.where("timestamp", "<=", to);
            q = q.orderBy("timestamp", "desc");
            if (cursor) {
                const cursorSnap = await adminDb.doc(`activity_logs/${cursor}`).get();
                if (cursorSnap.exists) q = q.startAfter(cursorSnap);
            }
            const snap = await q.limit(PAGE_SIZE + 1).get();
            const docs = snap.docs.slice(0, PAGE_SIZE);
            return NextResponse.json({
                logs: docs.map((d) => toLog(d.id, d.data())),
                nextCursor: snap.docs.length > PAGE_SIZE ? docs[docs.length - 1].id : null,
            });
        } catch (err) {
            if (!isMissingIndexError(err)) throw err;
        }

        // Fallback without composite indexes: single-field query, filter/sort/paginate in memory.
        const snap = await adminDb
            .collection("activity_logs")
            .where("user_id", "==", userId)
            .limit(FALLBACK_SCAN_LIMIT)
            .get();
        const all = snap.docs
            .map((d) => ({ id: d.id, data: d.data(), ts: logTime(d.data()) }))
            .filter((l) => (!category || l.data.category === category) && (from === null || l.ts >= from) && (to === null || l.ts <= to))
            .sort((a, b) => b.ts - a.ts || (a.id < b.id ? 1 : -1));

        let start = 0;
        if (cursor) {
            const idx = all.findIndex((l) => l.id === cursor);
            start = idx >= 0 ? idx + 1 : 0;
        }
        const page = all.slice(start, start + PAGE_SIZE);
        return NextResponse.json({
            logs: page.map((l) => toLog(l.id, l.data)),
            nextCursor: start + PAGE_SIZE < all.length ? page[page.length - 1].id : null,
            indexFallback: true,
        });
    } catch (err) {
        console.error("Team activity error:", err);
        return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
    }
}
