import { db } from "@/lib/firebase/config";
import { collection, addDoc } from "firebase/firestore";

export type ActivityLogCategory = "financial" | "auth" | "admin_action" | "course" | "system";
export type ActivityLogStatus = "success" | "failed" | "pending" | "info";
export type UserRole = "student" | "instructor" | "admin" | "system";

export interface ActivityLogInput {
    action: string;
    category: ActivityLogCategory;
    title: string;
    description: string;
    status: ActivityLogStatus;
    user_id?: string;
    user_name?: string;
    user_email?: string;
    user_role?: UserRole;
    target_user_id?: string;
    target_user_name?: string;
    amount?: number;
    metadata?: Record<string, any>;
    error_message?: string;
}

/**
 * Logs an activity to Firestore (client-side safe, non-blocking)
 */
export async function logActivity(entry: ActivityLogInput): Promise<string | null> {
    try {
        const logData = {
            ...entry,
            user_id: entry.user_id || "guest",
            user_name: entry.user_name || "مستخدم",
            user_email: entry.user_email || "",
            user_role: entry.user_role || "student",
            amount: typeof entry.amount === "number" ? entry.amount : null,
            metadata: entry.metadata || {},
            created_at: new Date().toISOString(),
            timestamp: Date.now(),
        };

        const docRef = await addDoc(collection(db, "activity_logs"), logData);
        return docRef.id;
    } catch (err) {
        console.warn("Failed to record activity log on client:", err);
        // Fallback to API endpoint if direct write is restricted
        try {
            fetch("/api/logs/record", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(entry),
            }).catch(() => {});
        } catch (_) {}
        return null;
    }
}
