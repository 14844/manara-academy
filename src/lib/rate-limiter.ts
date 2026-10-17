import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

let upstashRatelimit: Ratelimit | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
        const redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
        upstashRatelimit = new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(30, "60 s"),
            analytics: true,
            prefix: "manara:ratelimit",
        });
    } catch (e) {
        console.warn("Failed to initialize Upstash Redis ratelimiter, falling back to in-memory:", e);
    }
}

/**
 * Synchronous in-memory rate check (standard fallback)
 */
export function checkRateLimit(key: string, limit: number = 30, windowMs: number = 60000): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(key);

    if (!entry || now > entry.resetTime) {
        rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
        return true;
    }

    if (entry.count >= limit) {
        return false;
    }

    entry.count += 1;
    return true;
}

/**
 * Async rate limiter with Upstash Redis and automatic in-memory fallback
 */
export async function checkRateLimitAsync(
    key: string,
    limit: number = 30,
    windowSeconds: number = 60
): Promise<{ success: boolean; remaining?: number; reset?: number }> {
    if (upstashRatelimit) {
        try {
            const res = await upstashRatelimit.limit(key);
            return {
                success: res.success,
                remaining: res.remaining,
                reset: res.reset,
            };
        } catch (err) {
            console.warn("Upstash rate limit error, using memory fallback:", err);
        }
    }

    // In-memory fallback
    const passed = checkRateLimit(key, limit, windowSeconds * 1000);
    return { success: passed };
}

/**
 * Extract client IP from request headers, supporting Vercel and standard proxies.
 */
export function getClientIp(request: Request): string {
    const headers = request.headers;
    return (
        headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
        headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        headers.get("x-real-ip") ||
        "unknown"
    );
}
