"use client";

import { useEffect, useState } from "react";
import { getSupportSettings, SupportSettings, DEFAULT_SUPPORT } from "@/lib/support-settings";

/**
 * Custom hook for client-side components to fetch support settings.
 */
export function useSupportSettings() {
    const [settings, setSettings] = useState<SupportSettings>(DEFAULT_SUPPORT);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const data = await getSupportSettings();
                setSettings(data);
            } catch (error) {
                console.error("Hook fetch error:", error);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    return { settings, loading };
}
