/**
 * Online payment gateway switch. Off by default: set ONLINE_PAYMENTS_ENABLED=true (server) and
 * NEXT_PUBLIC_ONLINE_PAYMENTS_ENABLED=true (client UI) in Vercel once the gateway contract is signed.
 * Webhook / verify routes stay active so any payment already in flight can still settle.
 */
export const ONLINE_PAYMENTS_ENABLED = process.env.ONLINE_PAYMENTS_ENABLED === "true"

export const ONLINE_PAYMENTS_DISABLED_MESSAGE = "الدفع الإلكتروني سيتم فتحه قريباً. يمكنك حالياً شحن المحفظة عبر فودافون كاش أو إنستاباي."
