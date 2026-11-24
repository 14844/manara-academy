import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { getEffectivePlan, type EffectivePlan } from "@/lib/plans";

/**
 * Featured listing (pro + center): courses carry a denormalized `featured_until` (ISO string | null),
 * written ONLY here (server). /courses shows a course first with a "مميز" badge while featured_until > now,
 * so plan expiry needs no job.
 */
export function featuredUntilFor(eff: EffectivePlan): string | null {
    return eff.plan.access.featuredListing && eff.expiresAt ? eff.expiresAt : null;
}

/** Current featured_until value for an instructor, from profiles_private. */
export async function getInstructorFeaturedUntil(instructorId: string): Promise<string | null> {
    const snap = await adminDb.collection("profiles_private").doc(instructorId).get();
    return featuredUntilFor(getEffectivePlan(snap.exists ? snap.data() : null));
}

/** Set featured_until on all of an instructor's courses (batched, 400 writes per batch). */
export async function syncInstructorCoursesFeatured(instructorId: string, featuredUntil: string | null): Promise<number> {
    const snap = await adminDb.collection("courses").where("instructor_id", "==", instructorId).get();
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 400) {
        const batch = adminDb.batch();
        for (const d of docs.slice(i, i + 400)) batch.update(d.ref, { featured_until: featuredUntil });
        await batch.commit();
    }
    return docs.length;
}
