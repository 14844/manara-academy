export const BUNNY_CONFIG = {
    STORAGE_ZONE_NAME: process.env.BUNNY_STORAGE_ZONE_NAME,
    ACCESS_KEY: process.env.BUNNY_ACCESS_KEY,
    SECURITY_KEY: process.env.BUNNY_SECURITY_KEY,
    STORAGE_ENDPOINT: process.env.BUNNY_STORAGE_ENDPOINT || "storage.bunnycdn.com",
    PULL_ZONE_URL: process.env.NEXT_PUBLIC_BUNNY_PULL_ZONE_URL,
    
    // Bunny Stream (Video Library)
    VIDEO_LIBRARY_ID: process.env.BUNNY_VIDEO_LIBRARY_ID,
    STREAM_API_KEY: process.env.BUNNY_STREAM_API_KEY
};
