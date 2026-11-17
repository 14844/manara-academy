/**
 * Server-only plan gating helpers (firebase-admin). Never import from client components.
 *
 * Plans live in src/lib/plans.ts and gate INSTRUCTOR features only; this file resolves them from Firestore:
 *  - getInstructorPlan(uid)           → the instructor's effective plan right now
 *  - instructorHasAccess(uid, feature) → does that plan unlock `feature`
 *
 * Caching: pass the same `PlanAccessCache` object to several calls within one request to avoid
 * re-reading the same instructor's profiles_private doc. Without it each call reads fresh.
 */
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
