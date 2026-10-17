import { db } from "./firebase/config";
import { doc, getDoc, setDoc } from "firebase/firestore";

export interface SupportSettings {
    phone: string;
    email: string;
    updated_at?: string;
}

const SETTINGS_COLLECTION = "settings";
const SUPPORT_DOC = "support";

export const DEFAULT_SUPPORT: SupportSettings = {
    phone: "201017333215",
    email: "manaraacademyplatform@gmail.com"
};

/**
 * Fetch global support settings from Firestore.
 * Fallbacks to DEFAULT_SUPPORT if not found.
 */
export async function getSupportSettings(): Promise<SupportSettings> {
    try {
        const docRef = doc(db, SETTINGS_COLLECTION, SUPPORT_DOC);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data() as SupportSettings;
        }
        return DEFAULT_SUPPORT;
    } catch (error) {
        console.error("Error fetching support settings:", error);
        return DEFAULT_SUPPORT;
    }
}

/**
 * Update global support settings in Firestore.
 */
export async function updateSupportSettings(settings: SupportSettings): Promise<void> {
    const docRef = doc(db, SETTINGS_COLLECTION, SUPPORT_DOC);
    await setDoc(docRef, {
        ...settings,
        updated_at: new Date().toISOString()
    }, { merge: true });
}
