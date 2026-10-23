import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

let upstashRedis: Redis | null = null;
const upstashLimiters = new Map<string, Ratelimit>();

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
        upstashRedis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
    } catch {
        console.warn("Failed to initialize Upstash Redis ratelimiter, falling back to in-memory");
        upstashRedis = null;
    }
}

/** One Upstash limiter per (limit, window) pair so each call site gets its own limit. */
function getUpstashLimiter(limit: number, windowSeconds: number): Ratelimit | null {
    if (!upstashRedis) return null;
    const id = `${limit}:${windowSeconds}`;
    let rl = upstashLimiters.get(id);
    if (!rl) {
        rl = new Ratelimit({
            redis: upstashRedis,
            limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
            analytics: false,
            prefix: `manara:rl:${id}`,
        });
        upstashLimiters.set(id, rl);
    }
    return rl;
}

/**
 * Synchronous in-memory rate check (standard fallback)
 */
export function checkRateLimit(key: string, limit: number = 30, windowMs: number = 60000): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(key);

    if (!entry || now > entry.resetTime) {
        if (rateLimitMap.size > 10000) {
            for (const [k, v] of rateLimitMap) if (now > v.resetTime) rateLimitMap.delete(k);
        }
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
    const limiter = getUpstashLimiter(Math.max(1, Math.floor(limit)), Math.max(1, Math.floor(windowSeconds)));
    if (limiter) {
        try {
            const res = await limiter.limit(key);
            return {
                success: res.success,
                remaining: res.remaining,
                reset: res.reset,
            };
        } catch {
            console.warn("Upstash rate limit error, using memory fallback");
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
