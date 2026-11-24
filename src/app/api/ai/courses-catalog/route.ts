import { NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { adminDb } from "@/lib/firebase/admin"

/**
 * Read-only course catalog for the n8n AI agent's "get courses" tool.
 * Protected by the shared secret header `x-manara-bot-key` (= N8N_CHAT_SECRET).
 * Returns ONLY public listing fields of approved courses (same data shown on /courses).
 *   GET /api/ai/courses-catalog?q=<optional search>
 */

export const dynamic = "force-dynamic"

const CACHE_MS = 5 * 60 * 1000
let cache: { at: number; courses: CatalogCourse[] } | null = null

interface CatalogCourse {
    title: string
    subject: string
    grade: string | null
    price_egp: number
    instructor: string
    students: number
    url: string
}

function authorized(request: Request): boolean {
    const secret = process.env.N8N_CHAT_SECRET || ""
    const given = request.headers.get("x-manara-bot-key") || ""
    if (!secret || given.length !== secret.length) return false
    return timingSafeEqual(Buffer.from(given), Buffer.from(secret))
}

async function loadCatalog(): Promise<CatalogCourse[]> {
    if (cache && Date.now() - cache.at < CACHE_MS) return cache.courses
    const base = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "")
    const snap = await adminDb.collection("courses").where("status", "==", "approved").limit(300).get()
    const courses = snap.docs.map((d) => {
        const c = d.data()
        const price = Number(c.price || 0)
        return {
            title: String(c.title || ""),
            subject: String(c.category || "other"),
            grade: c.grade_level || c.gradeLevel || null,
            price_egp: Number.isFinite(price) ? price : 0,
            instructor: String(c.instructor_name || "مدرس المنصة"),
            students: Number(c.students_count || 0),
            url: `${base}/courses/${d.id}`,
        }
    })
    cache = { at: Date.now(), courses }
    return courses
}

export async function GET(request: Request) {
    if (!authorized(request)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    try {
        const q = (new URL(request.url).searchParams.get("q") || "").trim().toLowerCase().slice(0, 60)
        let courses = await loadCatalog()
        if (q) {
            const words = q.split(/\s+/).filter(Boolean)
            const hits = courses.filter((c) => {
                const hay = `${c.title} ${c.subject} ${c.grade || ""} ${c.instructor}`.toLowerCase()
                return words.some((w) => hay.includes(w))
            })
            // No match -> return the full list so the agent can still answer
            if (hits.length) courses = hits
        }
        return NextResponse.json({ count: courses.length, courses: courses.slice(0, 40) })
    } catch (e) {
        console.error("courses-catalog error:", e)
        return NextResponse.json({ error: "Internal error" }, { status: 500 })
    }
}
