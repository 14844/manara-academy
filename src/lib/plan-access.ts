/**
 * Server-only plan gating helpers (firebase-admin). Never import from client components.
 *
 * Plans live in src/lib/plans.ts; this file resolves them from Firestore:
 *  - getInstructorPlan(uid)           → the instructor's effective plan right now
 *  - instructorHasAccess(uid, feature) → does that plan unlock `feature`
 *  - studentHasLabsAccess(studentUid) → true when the student has at least one ACTIVE enrollment
 *                                        in a course whose instructor's effective plan has `labs`
 *
 * Caching: pass the same `PlanAccessCache` object to several calls within one request to avoid
 * re-reading the same instructor's profiles_private doc. Without it each call reads fresh.
 */
import type { DocumentData } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getEffectivePlan, type EffectivePlan, type PlanFeature } from "@/lib/plans";

export type PlanAccessCache = Map<string, Promise<EffectivePlan>>;

export function createPlanAccessCache(): PlanAccessCache {
    return new Map();
}

export function getInstructorPlan(uid: string, cache?: PlanAccessCache): Promise<EffectivePlan> {
    const cached = cache?.get(uid);
    if (cached) return cached;
    const p = adminDb
        .collection("profiles_private")
        .doc(uid)
        .get()
        .then((snap) => getEffectivePlan(snap.exists ? snap.data() : null))
        .catch(() => getEffectivePlan(null));
    cache?.set(uid, p);
    return p;
}

export async function instructorHasAccess(uid: string, feature: PlanFeature, cache?: PlanAccessCache): Promise<boolean> {
    if (!uid) return false;
    const eff = await getInstructorPlan(uid, cache);
    return eff.plan.access[feature] === true;
}

/** Enrollments only grant access while `status === "active"` (same rule as video/storage signing). */
function isEnrollmentActive(data: DocumentData, now: number): boolean {
    if (data.status !== "active") return false;
    // Defensive: honour an access expiry if a future flow ever sets one.
    for (const key of ["expires_at", "access_expires_at"]) {
        const v = data[key];
        if (typeof v === "string" && v) {
            const t = new Date(v).getTime();
            if (Number.isFinite(t) && t < now) return false;
        }
    }
    return true;
}

export async function studentHasLabsAccess(studentUid: string, cache?: PlanAccessCache): Promise<boolean> {
    if (!studentUid) return false;
    const planCache = cache || createPlanAccessCache();
    const now = Date.now();

    const enrollSnap = await adminDb.collection("enrollments").where("student_id", "==", studentUid).get();
    const active = enrollSnap.docs.map((d) => d.data()).filter((d) => isEnrollmentActive(d, now));
    if (active.length === 0) return false;

    const instructorIds = new Set<string>();
    const coursesMissingInstructor = new Set<string>();
    for (const e of active) {
        if (typeof e.instructor_id === "string" && e.instructor_id) instructorIds.add(e.instructor_id);
        else if (typeof e.course_id === "string" && e.course_id && !e.course_id.includes("/")) coursesMissingInstructor.add(e.course_id);
    }

    // Older enrollments may not carry instructor_id: resolve it from the course doc.
    if (coursesMissingInstructor.size > 0) {
        const refs = Array.from(coursesMissingInstructor).map((id) => adminDb.collection("courses").doc(id));
        const courseSnaps = await adminDb.getAll(...refs);
        for (const s of courseSnaps) {
            const iid = s.exists ? s.data()?.instructor_id : null;
            if (typeof iid === "string" && iid) instructorIds.add(iid);
        }
    }

    const results = await Promise.all(Array.from(instructorIds).map((iid) => instructorHasAccess(iid, "labs", planCache)));
    return results.some(Boolean);
}
