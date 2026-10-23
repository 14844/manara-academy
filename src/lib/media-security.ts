/**
 * Shared helpers for upload/media hardening (image sniffing, storage path scoping).
 * Server-only.
 */

export const IMAGE_MIMES = ["image/png", "image/jpeg", "image/webp"] as const;
export type ImageMime = (typeof IMAGE_MIMES)[number];

const IMAGE_EXT: Record<ImageMime, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
};

/** Detect PNG / JPEG / WEBP from magic bytes. Returns null for anything else. */
export function detectImageMime(buffer: Uint8Array): ImageMime | null {
    if (buffer.length < 12) return null;
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
        buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a) {
        return "image/png";
    }
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return "image/jpeg";
    }
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
        return "image/webp";
    }
    return null;
}

/** Normalise a declared content type ("image/png; charset=x" -> "image/png") and check it's a whitelisted image. */
export function normalizeImageMime(contentType: string | null | undefined): ImageMime | null {
    const base = String(contentType || "").split(";")[0].trim().toLowerCase();
    return (IMAGE_MIMES as readonly string[]).includes(base) ? (base as ImageMime) : null;
}

/** Force the file extension to match the (whitelisted) image mime. */
export function withImageExtension(fileName: string, mime: ImageMime): string {
    const base = fileName.replace(/\.[A-Za-z0-9]{1,8}$/, "");
    return `${base || "image"}.${IMAGE_EXT[mime]}`;
}

/** Safe headers for serving user-uploaded images from our own origin. */
export function safeImageHeaders(mime: ImageMime, fileName: string, cacheControl: string): Record<string, string> {
    const safeName = fileName.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 100) || "image";
    return {
        "Content-Type": mime,
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `inline; filename="${safeName}"`,
        "Cross-Origin-Resource-Policy": "same-site",
        "Cache-Control": cacheControl,
    };
}

function projectSupabaseHost(): string {
    try {
        return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host : "";
    } catch {
        return "";
    }
}

/**
 * Turn any stored media reference into a bare storage path inside our bucket
 * (e.g. "videos/courses/<id>/file.mp4"). Accepts:
 *  - "supabase://path", "/path", "path"
 *  - "/api/storage/sign?url=path"
 *  - full URLs on THIS project's Supabase host only
 * Returns null for foreign hosts, traversal attempts or unparsable input.
 */
export function extractStoragePath(raw: string, bucket: string): string | null {
    if (!raw || typeof raw !== "string") return null;
    let str = raw.trim();
    if (str.includes("\0")) return null;

    if (str.includes("/api/storage/sign")) {
        try {
            const u = new URL(str, "https://placeholder.local");
            str = u.searchParams.get("url") || u.searchParams.get("path") || "";
        } catch {
            return null;
        }
    }

    if (/^https?:\/\//i.test(str)) {
        let u: URL;
        try {
            u = new URL(str);
        } catch {
            return null;
        }
        const host = projectSupabaseHost();
        if (!host || u.host !== host) return null;
        const m = u.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/(.+)$/);
        if (!m) return null;
        str = decodeURIComponent(m[1]);
        if (str.startsWith(`${bucket}/`)) str = str.slice(bucket.length + 1);
        else return null;
    }

    str = str.replace(/^supabase:\/\//, "").replace(/^\/+/, "").split("?")[0];
    if (!str || str.includes("..") || str.includes("\\")) return null;
    return str;
}

/** True if the storage path belongs to the given course's folders. */
export function isCourseScopedPath(path: string, courseId: string): boolean {
    if (!path || !courseId || !/^[\w-]+$/.test(courseId)) return false;
    return (
        path.startsWith(`videos/courses/${courseId}/`) ||
        path.startsWith(`files/courses/${courseId}/`) ||
        path.startsWith(`courses/${courseId}/`)
    );
}

export const BUNNY_GUID_RE = /^[0-9a-fA-F-]{32,36}$/;

/**
 * Verify that `courseId` is a well-formed id of an existing course owned by the user (admins: any course).
 * Returns an error message, or null when allowed.
 */
export async function checkCourseOwnership(
    courseId: string | null | undefined,
    user: { uid: string; role: string }
): Promise<string | null> {
    if (!courseId || typeof courseId !== "string" || !/^[\w-]+$/.test(courseId)) {
        return "معرّف الكورس غير صالح";
    }
    const { adminDb } = await import("@/lib/firebase/admin");
    const snap = await adminDb.collection("courses").doc(courseId).get();
    if (!snap.exists) return "الكورس غير موجود";
    if (user.role !== "admin" && snap.data()?.instructor_id !== user.uid) {
        return "غير مصرح لك بالرفع لهذا الكورس";
    }
    return null;
}
