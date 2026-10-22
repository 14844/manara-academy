import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { getServerAuth } from "@/lib/server-auth";
import { logServerActivity } from "@/lib/server-activity-logger";

export async function POST(request: Request) {
    try {
        let adminUser = await getServerAuth(request);
        
        let body: any = {};
        try {
            body = await request.json();
        } catch {}

        if (!adminUser && body?.idToken) {
            try {
                const decoded = await adminAuth.verifyIdToken(body.idToken);
                const profileDoc = await adminDb.collection("profiles").doc(decoded.uid).get();
                const profileData = profileDoc.data() || {};
                if (profileData.role === "admin") {
                    adminUser = {
                        uid: decoded.uid,
                        email: decoded.email,
                        role: "admin",
                        profile: profileData,
                    };
                }
            } catch (tokenErr) {
                console.error("Token verification failed in logs clear:", tokenErr);
            }
        }

        if (!adminUser || adminUser.role !== "admin") {
            return NextResponse.json({ error: "غير مصرح لك بتنفيذ هذه العملية" }, { status: 403 });
        }

        // Wipe activity_logs in batches of 300
        const logsCol = adminDb.collection("activity_logs");
        const snapshot = await logsCol.get();

        if (!snapshot.empty) {
            const batchSize = 300;
            let batch = adminDb.batch();
            let count = 0;

            for (const doc of snapshot.docs) {
                batch.delete(doc.ref);
                count++;
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
            description: `قام المسؤول (${adminUser.profile?.full_name || adminUser.email || "مسؤول المنصة"}) بتصفير سجلات النشاط لبدء دورة اختبار جديدة.`,
            status: "success",
            user_id: adminUser.uid,
            user_name: adminUser.profile?.full_name || "مسؤول المنصة",
            user_email: adminUser.email || "",
            user_role: "admin",
            metadata: {
                cleared_count: snapshot.size,
                cleared_at: new Date().toISOString(),
            }
        });

        return NextResponse.json({
            success: true,
            clearedCount: snapshot.size,
            message: `تم تصفير ${snapshot.size} سجل بنجاح`,
        });
    } catch (error: any) {
        console.error("Error clearing logs:", error);
        return NextResponse.json({ error: error.message || "فشل تصفير السجلات" }, { status: 500 });
    }
}
