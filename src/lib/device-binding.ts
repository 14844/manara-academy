import crypto from "crypto";

/**
 * Server-side device binding (server-only).
 * The client-supplied device id is never stored or trusted on its own: it is bound to a
 * fingerprint of the request headers, and only that bound id is kept in active_devices.
 */
export function computeDeviceBinding(request: Request, deviceId: string): { deviceFingerprint: string; boundDeviceId: string } {
    const userAgent = request.headers.get("user-agent") || "";
    const acceptLanguage = request.headers.get("accept-language") || "";
    const deviceFingerprint = crypto
        .createHash("sha256")
        .update(`${userAgent}||${acceptLanguage}`)
        .digest("hex")
        .slice(0, 32);

    const boundDeviceId = crypto
        .createHash("sha256")
        .update(`${deviceId.trim()}::${deviceFingerprint}`)
        .digest("hex")
        .slice(0, 32);

    return { deviceFingerprint, boundDeviceId };
}
