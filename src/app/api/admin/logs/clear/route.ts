import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { logActor, requirePermission } from "@/lib/server-auth";
import { errorText, logServerActivity } from "@/lib/server-activity-logger";

/** Logs from the last RETENTION_DAYS days can never be archived/cleared. */
const RETENTION_DAYS = 90;
const PAGE_SIZE = 400;

export async function POST(request: Request) {
    // Session cookie only (no idToken fallback); revoked sessions are rejected by getServerAuth.
    // Denied attempts are logged centrally by requirePermission.
    const adminUser = await requirePermission(request, "logs.clear");
    if (!adminUser) {
        return NextResponse.json({ error: "غير مصرح لك بتنفيذ هذه العملية" }, { status: 403 });
    }

    const cutoffDate = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const cutoffIso = cutoffDate.toISOString();
    const actorName = adminUser.profile?.full_name || adminUser.email || "مسؤول المنصة";

    let archivedCount = 0;
    let oldest: string | null = null;
    let newest: string | null = null;

    try {
        // Archive-only (never deleted) and only entries older than the retention window.
        // Audit entries about clearing logs are permanent and are never archived.
        const archivedAt = new Date().toISOString();
        let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;

        // eslint-disable-next-line no-constant-condition
        while (true) {
            let q = adminDb
                .collection("activity_logs")
                .where("created_at", "<", cutoffIso)
                .orderBy("created_at", "asc")
                .limit(PAGE_SIZE);
            if (cursor) q = q.startAfter(cursor);
            const snap = await q.get();
            if (snap.empty) break;

            const batch = adminDb.batch();
            let inBatch = 0;
            for (const doc of snap.docs) {
                const d = doc.data() || {};
                if (d.archived === true) continue;
                if (d.action === "logs_cleared" || d.category === "security") continue;
                batch.update(doc.ref, { archived: true, archived_at: archivedAt, archived_by: adminUser.uid });
                inBatch++;
                archivedCount++;
                const createdAt = typeof d.created_at === "string" ? d.created_at : null;
                if (createdAt) {
                    if (!oldest || createdAt < oldest) oldest = createdAt;
                    if (!newest || createdAt > newest) newest = createdAt;
                }
            }
            if (inBatch > 0) await batch.commit();
            cursor = snap.docs[snap.docs.length - 1];
            if (snap.size < PAGE_SIZE) break;
        }
    } catch (error) {
        console.error("Error clearing logs:", error);
        await logServerActivity({
            action: "logs_cleared",
            category: "security",
            title: "فشل أرشفة سجلات النشاط",
            description: `حاول ${actorName} أرشفة سجلات النشاط الأقدم من ${RETENTION_DAYS} يوماً وفشلت العملية بعد أرشفة ${archivedCount} سجل.`,
            status: "failed",
            ...logActor(adminUser),
            error_message: errorText(error),
            metadata: { archived_count: archivedCount, cutoff: cutoffIso, retention_days: RETENTION_DAYS, range_from: oldest, range_to: newest },
        }, request);
        return NextResponse.json({ error: "فشل أرشفة السجلات القديمة" }, { status: 500 });
    }

    // Permanent audit entry (security category, never archivable)
    await logServerActivity({
        action: "logs_cleared",
        category: "security",
        title: "أرشفة سجلات النشاط القديمة",
        description: archivedCount > 0
            ? `قام ${actorName} بأرشفة ${archivedCount} سجل أقدم من ${RETENTION_DAYS} يوماً (من ${oldest ?? "-"} إلى ${newest ?? "-"}). سجلات آخر ${RETENTION_DAYS} يوماً لم تُمس.`
            : `قام ${actorName} بتشغيل أرشفة السجلات ولم توجد سجلات أقدم من ${RETENTION_DAYS} يوماً.`,
        status: "success",
        ...logActor(adminUser),
        metadata: {
            archived_count: archivedCount,
            cutoff: cutoffIso,
            retention_days: RETENTION_DAYS,
            range_from: oldest,
            range_to: newest,
        },
    }, request);

    return NextResponse.json({
        success: true,
        clearedCount: archivedCount,
        message: archivedCount > 0
            ? `تمت أرشفة ${archivedCount} سجل أقدم من ${RETENTION_DAYS} يوماً`
            : `لا توجد سجلات أقدم من ${RETENTION_DAYS} يوماً لأرشفتها`,
    });
}
