import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import type { ActivityLogInput } from "./activity-logger";

/** Minimal shape of an authenticated actor (structurally compatible with ServerUser from server-auth). */
export interface LogActor {
    uid: string;
    email?: string;
    role?: string;
    profile?: any;
}

/** Fields describing who performed an action, taken from the server-side session. */
export function actorFields(actor: LogActor | null | undefined): Pick<ActivityLogInput, "user_id" | "user_name" | "user_email" | "user_role"> {
    if (!actor) return {};
    return {
        user_id: actor.uid,
        user_name: actor.profile?.full_name || actor.email || actor.uid,
        user_email: actor.email || actor.profile?.email || "",
        user_role: (actor.role || "student") as ActivityLogInput["user_role"],
    };
}

/** Best-effort client IP from proxy headers. */
export function ipFromHeaders(h: Headers | null | undefined): string {
    if (!h) return "";
    return (
        h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        h.get("x-real-ip")?.trim() ||
        h.get("cf-connecting-ip")?.trim() ||
        ""
    );
}

async function requestContext(request?: Request | null) {
    let hdrs: Headers | null = null;
    let path = "";
    let method = "";
    try {
        if (request) {
            hdrs = request.headers;
            method = request.method || "";
            try {
                path = new URL(request.url).pathname;
            } catch {
                path = "";
            }
        } else {
            // Inside a route handler without an explicit Request: fall back to the incoming request headers.
            const { headers } = await import("next/headers");
            hdrs = (await headers()) as unknown as Headers;
        }
    } catch {
        // Outside a request scope (scripts, background jobs) -> no request context.
    }
    return {
        ip_address: ipFromHeaders(hdrs).slice(0, 100),
        user_agent: (hdrs?.get("user-agent") || "").slice(0, 400),
        request_path: path.slice(0, 300),
        request_method: method.slice(0, 10),
    };
}

function stripUndefined<T extends Record<string, any>>(obj: T): T {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
        if (v !== undefined) out[k] = v;
    }
    return out as T;
}

/**
 * Server-side activity logger using Firebase Admin SDK.
 *
 * Always records: actor (uid / name / email / role — falls back to `actor` then "system"),
 * IP, user agent, request path & method (when a Request is passed), ISO + epoch timestamps and a
 * Firestore server timestamp. Never throws.
 */
export async function logServerActivity(
    entry: ActivityLogInput,
    request?: Request | null,
    actor?: LogActor | null,
): Promise<string | null> {
    try {
        const ctx = await requestContext(request);
        const fromActor = actorFields(actor);
        const now = new Date();

        const logData = stripUndefined({
            ...entry,
            user_id: entry.user_id || fromActor.user_id || "system",
            user_name: entry.user_name || fromActor.user_name || "النظام",
            user_email: entry.user_email || fromActor.user_email || "",
            user_role: entry.user_role || fromActor.user_role || "system",
            amount: typeof entry.amount === "number" && Number.isFinite(entry.amount) ? entry.amount : null,
            metadata: entry.metadata ? stripUndefined(entry.metadata) : {},
            ip_address: ctx.ip_address || "",
            user_agent: ctx.user_agent || "",
            request_path: ctx.request_path || "",
            request_method: ctx.request_method || "",
            source: entry.source === "client" ? "client" : "server",
            created_at: now.toISOString(),
            timestamp: now.getTime(),
            server_time: FieldValue.serverTimestamp(),
        });

        const docRef = await adminDb.collection("activity_logs").add(logData);
        return docRef.id;
    } catch (err) {
        console.error("Failed to record server activity log:", err);
        return null;
    }
}

/** Short Arabic-safe error string for logs. */
export function errorText(err: unknown): string {
    try {
        if (err instanceof Error) return err.message.slice(0, 500);
        return String(err).slice(0, 500);
    } catch {
        return "unknown error";
    }
}
