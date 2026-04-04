"use server";

import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { SupportSettings } from "@/lib/support-settings";
import { adminDb } from "@/lib/firebase/admin";

const SETTINGS_COLLECTION = "settings";
const SUPPORT_DOC = "support";

export async function updateSupportAction(settings: SupportSettings) {
    noStore();
    try {
        const docRef = adminDb.collection(SETTINGS_COLLECTION).doc(SUPPORT_DOC);
        await docRef.set({
            ...settings,
            updated_at: new Date().toISOString()
        }, { merge: true });

        // Clear caches for all public pages that show support info
        revalidatePath("/");
        revalidatePath("/help");
        revalidatePath("/faq");
        return { success: true };
    } catch (error) {
        console.error("Action error:", error);
        return { success: false, error: "Failed to update settings" };
    }
}
