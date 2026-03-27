export const BUNNY_CONFIG = {
    STORAGE_ZONE_NAME: process.env.BUNNY_STORAGE_ZONE_NAME || "manar-aacademy",
    ACCESS_KEY: process.env.BUNNY_ACCESS_KEY || "3c738937-d1a7-42fe-867570f4a92d-f87d-4ff4",
    SECURITY_KEY: process.env.BUNNY_SECURITY_KEY || "c8a77020-ba31-4c09-83d5-2167936cb16c",
    STORAGE_ENDPOINT: process.env.BUNNY_STORAGE_ENDPOINT || "storage.bunnycdn.com",
    PULL_ZONE_URL: process.env.NEXT_PUBLIC_BUNNY_PULL_ZONE_URL || "https://manaraacademy.b-cdn.net",
    
    // Bunny Stream (Video Library)
    VIDEO_LIBRARY_ID: "626740",
    STREAM_API_KEY: "f457fba7-6db4-475b-b458e7ac16dc-2eed-4948"
};
