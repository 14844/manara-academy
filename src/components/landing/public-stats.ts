import { db } from "@/lib/firebase/config"
import { collection, getDocs, query, where } from "firebase/firestore"

/**
 * Real, public numbers for the landing page — computed from the publicly readable
 * `courses` collection only (profiles are not publicly listable).
 *
 * A course counts as "published" with the same rule the enroll / payment APIs use:
 *   status === "approved" && is_published !== false
 */
export interface PublicStats {
    coursesCount: number
    instructorsCount: number
    /** Sum of students_count across published courses (= enrollments, not unique students). */
    enrollmentsCount: number
}

/** Below these values a number is not meaningful enough to show publicly. */
export const STAT_THRESHOLDS = {
    courses: 10,
    instructors: 5,
    enrollments: 100,
} as const

export function isPublishedCourse(course: { status?: unknown; is_published?: unknown }): boolean {
    return course.status === "approved" && course.is_published !== false
}

const CACHE_TTL_MS = 10 * 60 * 1000
const TIMEOUT_MS = 2500
let cached: { at: number; value: PublicStats } | null = null

async function computeStats(): Promise<PublicStats> {
    const snap = await getDocs(query(collection(db, "courses"), where("status", "==", "approved")))
    const instructors = new Set<string>()
    let coursesCount = 0
    let enrollmentsCount = 0
    snap.forEach((d) => {
        const data = d.data()
        if (!isPublishedCourse(data)) return
        coursesCount++
        if (typeof data.instructor_id === "string" && data.instructor_id) instructors.add(data.instructor_id)
        const n = Number(data.students_count)
        if (Number.isFinite(n) && n > 0) enrollmentsCount += n
    })
    return { coursesCount, instructorsCount: instructors.size, enrollmentsCount }
}

/**
 * Returns real stats, or null if they could not be loaded quickly.
 * Cached in memory per server instance so the landing page doesn't hit Firestore on every request.
 */
export async function getPublicStats(): Promise<PublicStats | null> {
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value
    try {
        const value = await Promise.race([
            computeStats(),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
        ])
        if (value) cached = { at: Date.now(), value }
        return value ?? cached?.value ?? null
    } catch (error) {
        console.error("Error computing public stats:", error)
        return cached?.value ?? null
    }
}
