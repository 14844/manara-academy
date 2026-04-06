export const BUNNY_CONFIG = {
    STORAGE_ZONE_NAME: process.env.BUNNY_STORAGE_ZONE_NAME || "manara-academy-last-version",
    ACCESS_KEY: process.env.BUNNY_ACCESS_KEY || "c2cdebf7-16fd-4720-aa94d21c67e7-c332-4230",
    SECURITY_KEY: process.env.BUNNY_SECURITY_KEY || "820de92a-12ec-47d3-8212-ac22fd39e435",
    STORAGE_ENDPOINT: process.env.BUNNY_STORAGE_ENDPOINT || "storage.bunnycdn.com",
    PULL_ZONE_URL: process.env.NEXT_PUBLIC_BUNNY_PULL_ZONE_URL || "https://vz-174691e9-447.b-cdn.net",
    
    // Bunny Stream (Video Library)
    VIDEO_LIBRARY_ID: "632067",
    STREAM_API_KEY: "80bcbd45-1372-40a6-a7bc328554ac-70b7-4ee0"
};
