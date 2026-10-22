import { adminDb } from "@/lib/firebase/admin";
import { ActivityLogInput } from "./activity-logger";

/**
 * Server-side activity logger using Firebase Admin SDK
 */
export async function logServerActivity(entry: ActivityLogInput): Promise<string | null> {
    try {
        const logData = {
            ...entry,
            user_id: entry.user_id || "system",
            user_name: entry.user_name || "النظام",
            user_email: entry.user_email || "",
            user_role: entry.user_role || "system",
            amount: typeof entry.amount === "number" ? entry.amount : null,
            metadata: entry.metadata || {},
            created_at: new Date().toISOString(),
            timestamp: Date.now(),
        };

        const docRef = await adminDb.collection("activity_logs").add(logData);
        return docRef.id;
    } catch (err) {
        console.error("Failed to record server activity log:", err);
        return null;
    }
}
