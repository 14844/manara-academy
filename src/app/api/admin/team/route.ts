import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requirePermission } from "@/lib/server-auth";
import { FALLBACK_SCAN_LIMIT, isMissingIndexError, logTime, TEAM_ROLES } from "./team-utils";

const DAY = 24 * 60 * 60 * 1000;

interface ActivityStats {
    count_7d: number;
    count_30d: number;
    last_action_at: string | null;
    last_action_title: string | null;
}

async function getActivityStats(uid: string): Promise<ActivityStats> {
    const now = Date.now();
    const since7 = now - 7 * DAY;
    const since30 = now - 30 * DAY;
    const logs = adminDb.collection("activity_logs");

    try {
        // Needs composite index activity_logs (user_id ASC, timestamp DESC)
        const [c7, c30, lastSnap] = await Promise.all([
            logs.where("user_id", "==", uid).where("timestamp", ">=", since7).count().get(),
            logs.where("user_id", "==", uid).where("timestamp", ">=", since30).count().get(),
            logs.where("user_id", "==", uid).orderBy("timestamp", "desc").limit(1).get(),
        ]);
        const last = lastSnap.docs[0]?.data();
        return {
            count_7d: c7.data().count,
            count_30d: c30.data().count,
            last_action_at: last ? new Date(logTime(last)).toISOString() : null,
            last_action_title: last?.title || null,
        };
    } catch (err) {
        if (!isMissingIndexError(err)) throw err;
        // Fallback without a composite index: single-field query + in-memory aggregation.
        const snap = await logs
            .where("user_id", "==", uid)
            .select("timestamp", "created_at", "title")
            .limit(FALLBACK_SCAN_LIMIT)
            .get();
        let count7 = 0;
        let count30 = 0;
        let lastTs = 0;
        let lastTitle: string | null = null;
        for (const d of snap.docs) {
            const data = d.data();
            const ts = logTime(data);
            if (ts >= since7) count7++;
            if (ts >= since30) count30++;
            if (ts > lastTs) {
                lastTs = ts;
                lastTitle = data.title || null;
            }
        }
        return {
            count_7d: count7,
            count_30d: count30,
            last_action_at: lastTs ? new Date(lastTs).toISOString() : null,
            last_action_title: lastTitle,
        };
    }
}

/**
 * GET /api/admin/team
 * Admin + staff members with status, last login and activity stats (team.view — admin only).
 */
export async function GET(request: Request) {
    try {
        const user = await requirePermission(request, "team.view");
        if (!user) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const profilesSnap = await adminDb.collection("profiles").where("role", "in", TEAM_ROLES).get();

        const members = await Promise.all(
            profilesSnap.docs.map(async (doc) => {
                const pub = doc.data();
                const [privSnap, stats] = await Promise.all([
                    adminDb.doc(`profiles_private/${doc.id}`).get(),
                    getActivityStats(doc.id).catch((e) => {
                        console.error("team stats error:", e);
                        return { count_7d: 0, count_30d: 0, last_action_at: null, last_action_title: null } as ActivityStats;
                    }),
                ]);
                const priv = privSnap.data() || {};
                return {
                    id: doc.id,
                    full_name: pub.full_name || "",
                    email: priv.email || pub.email || "",
                    phone: priv.phone || "",
                    avatar_url: pub.avatar_url || pub.photoURL || "",
                    role: pub.role,
                    // Backoffice accounts are implicitly active when no status is stored (mirrors server-auth).
                    status: priv.status || "active",
                    last_login: pub.last_login || priv.last_login || null,
                    created_at: pub.created_at || null,
                    is_self: doc.id === user.uid,
                    ...stats,
                };
            })
        );

        members.sort((a, b) => {
            if (a.role === "admin" && b.role !== "admin") return -1;
            if (b.role === "admin" && a.role !== "admin") return 1;
            return String(a.full_name).localeCompare(String(b.full_name), "ar");
        });

        return NextResponse.json({ members });
    } catch (err) {
        console.error("Team list error:", err);
        return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
    }
}
