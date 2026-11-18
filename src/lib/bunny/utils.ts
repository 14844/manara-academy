import crypto from 'crypto';

/**
 * Signs a Bunny.net URL using Token Authentication (V2 SHA256)
 * Supports token_path for HLS streaming directories.
 */
export function signBunnyUrl(
    url: string, 
    securityKey: string | undefined, 
    expirationTimeInSeconds: number = 7200,
    tokenPath?: string
) {
    if (!url) return "";
    if (!securityKey) {
        console.warn("Bunny signing requested but SECURITY_KEY is missing!");
        return url; // Still return original to avoid catastrophic crash, but warn
    }

    try {
        const parsedUrl = new URL(url);
        // Normalize path: must start with / and avoid double slashes
        let path = parsedUrl.pathname;
        if (!path.startsWith('/')) path = '/' + path;
        
        const expires = Math.floor(Date.now() / 1000) + expirationTimeInSeconds;
        
        // If tokenPath is provided (for HLS folders), we use it in the hash
        // instead of the specific file path, but Bunny docs say token_path 
        // param should also be appended.
        const pathToHash = tokenPath || path;
        
        // Bunny.net V2 Algorithm (Modern SHA256): 
        // Base64(SHA256(securityKey + path + expires))
        const hashable = securityKey + pathToHash + expires.toString();
        const hash = crypto.createHash('sha256').update(hashable).digest('base64')
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        
        parsedUrl.searchParams.set('token', hash);
        parsedUrl.searchParams.set('expires', expires.toString());
        if (tokenPath) {
            parsedUrl.searchParams.set('token_path', tokenPath);
        }
        
        return parsedUrl.toString();
    } catch (error) {
        console.error("Bunny signing failed:", error);
        return url;
    }
}
