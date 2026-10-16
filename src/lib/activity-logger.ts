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
 * Logs an activity via the secure server-side endpoint /api/logs/record
 */
export async function logActivity(entry: ActivityLogInput): Promise<string | null> {
    try {
        const res = await fetch("/api/logs/record", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(entry),
        });
        if (res.ok) {
            const data = await res.json().catch(() => ({}));
            return data.logId || null;
        }
        return null;
    } catch {
        return null;
    }
}
