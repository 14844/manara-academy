import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getServerAuth } from "@/lib/server-auth";
import { logServerActivity } from "@/lib/server-activity-logger";

export async function POST(request: Request) {
    try {
        // Session cookie only (no idToken fallback); revoked sessions are rejected by getServerAuth
        const adminUser = await getServerAuth(request);

        if (!adminUser || adminUser.role !== "admin") {
            return NextResponse.json({ error: "غير مصرح لك بتنفيذ هذه العملية" }, { status: 403 });
        }

        // Archive-only: logs are never deleted (audit trail). Mark them archived in batches.
        const logsCol = adminDb.collection("activity_logs");
        const snapshot = await logsCol.get();
        const archivedAt = new Date().toISOString();
        let archivedCount = 0;

        if (!snapshot.empty) {
            const batchSize = 300;
            let batch = adminDb.batch();
            let count = 0;

            for (const doc of snapshot.docs) {
                if (doc.data()?.archived === true) continue;
                batch.update(doc.ref, { archived: true, archived_at: archivedAt, archived_by: adminUser.uid });
                count++;
                archivedCount++;
                if (count >= batchSize) {
                    await batch.commit();
                    batch = adminDb.batch();
                    count = 0;
                }
            }
            if (count > 0) {
                await batch.commit();
            }
        }

        // Add one clean log entry recording the reset
        await logServerActivity({
            action: "logs_cleared",
            category: "admin_action",
            title: "تصفير سجلات النشاط",
            description: `قام المسؤول (${adminUser.profile?.full_name || adminUser.email || "مسؤول المنصة"}) بأرشفة سجلات النشاط (بدون حذف).`,
            status: "success",
            user_id: adminUser.uid,
            user_name: adminUser.profile?.full_name || "مسؤول المنصة",
            user_email: adminUser.email || "",
            user_role: "admin",
            metadata: {
                archived_count: archivedCount,
                cleared_at: new Date().toISOString(),
            }
        });

        return NextResponse.json({
            success: true,
            clearedCount: archivedCount,
            message: `تمت أرشفة ${archivedCount} سجل بنجاح`,
        });
    } catch (error: any) {
        console.error("Error clearing logs:", error);
        return NextResponse.json({ error: error.message || "فشل تصفير السجلات" }, { status: 500 });
    }
}
