import crypto from "crypto";

export interface FawaterakCustomer {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    uniqueId?: string;
}

export interface CreateFawaterakSessionParams {
    amount: number;
    customer: FawaterakCustomer;
    studentId: string;
    baseUrl: string;
}

export interface FawaterakSessionResult {
    paymentUrl: string;
    intentKey: string;
}

// In-memory token cache to avoid requesting token on every single call
let cachedToken: { token: string; expiresAt: number } | null = null;

function getBaseApiUrl(): string {
    const env = process.env.FAWATERAK_ENV || "live";
    return env === "staging" || env === "test"
        ? "https://staging.fawaterk.com"
        : "https://app.fawaterk.com";
}

/**
 * Obtain an OAuth Bearer access token using Client ID & Client Secret
 */
export async function getFawaterakAccessToken(): Promise<string> {
    let clientId = process.env.FAWATERAK_CLIENT_ID;
    let clientSecret = process.env.FAWATERAK_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        try {
            const { adminDb } = await import("@/lib/firebase/admin");
            const docSnap = await adminDb.collection("settings").doc("fawaterak").get();
            if (docSnap.exists) {
                const data = docSnap.data();
                clientId = data?.client_id || clientId;
                clientSecret = data?.client_secret || clientSecret;
            }
        } catch (e) {
            // ignore
        }
    }

    if (!clientId || !clientSecret) {
        throw new Error("بيانات فواتيرك غير مكتملة (يرجى إدخال Client ID و Client Secret في إعدادات المنصة أو ملف .env)");
    }

    // Check cached token
    const now = Date.now();
    if (cachedToken && cachedToken.expiresAt > now + 60000) {
        return cachedToken.token;
    }

    const apiUrl = getBaseApiUrl();
    const tokenRes = await fetch(`${apiUrl}/oauth/token`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        body: JSON.stringify({
            grant_type: "client_credentials",
            client_id: clientId.trim(),
            client_secret: clientSecret.trim(),
        }),
    });


    if (!tokenRes.ok) {
        const errorText = await tokenRes.text();
        console.error("Fawaterak Auth Token Error:", errorText);
        throw new Error(`فشل تسجيل الدخول لبوابة فواتيرك (${tokenRes.status}): يرجى التحقق من Client ID و Client Secret`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const expiresIn = Number(tokenData.expires_in) || 86400; // default 24h

    cachedToken = {
        token: accessToken,
        expiresAt: now + expiresIn * 1000,
    };

    return accessToken;
}

/**
 * Creates a hosted checkout transaction link on Fawaterak
 */
export async function createFawaterakTransaction({
    amount,
    customer,
    studentId,
    baseUrl,
}: CreateFawaterakSessionParams): Promise<FawaterakSessionResult> {
    const token = await getFawaterakAccessToken();
    const apiUrl = getBaseApiUrl();

    // Clean phone number (Egyptian local format 01xxxxxxxxx or +20)
    let cleanPhone = (customer.phone || "01000000000").replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("20") && cleanPhone.length > 10) {
        cleanPhone = "0" + cleanPhone.slice(2);
    }
    if (cleanPhone.length < 11) {
        cleanPhone = "01000000000";
    }

    const cleanFirstName = (customer.firstName || "طالب").trim();
    const cleanLastName = (customer.lastName || "المنارة").trim();

    const payloadData = {
        student_id: studentId,
        amount: Number(amount),
        type: "wallet_recharge",
        created_at: new Date().toISOString(),
    };

    const requestBody = {
        cartTotal: Number(amount),
        currency: "EGP",
        customer: {
            first_name: cleanFirstName || "طالب",
            last_name: cleanLastName || "المنارة",
            email: customer.email || `student_${studentId}@manara.academy`,
            phone: cleanPhone,
            customer_unique_id: studentId,
        },
        cartItems: [
            {
                name: "شحن رصيد المحفظة - أكاديمية المنارة",
                price: Number(amount),
                quantity: 1,
            },
        ],
        pay_load: payloadData,
        redirectionUrls: {
            successUrl: `${baseUrl}/dashboard/wallet?fawaterak=success&amount=${amount}`,
            failUrl: `${baseUrl}/dashboard/wallet?fawaterak=failed`,
            pendingUrl: `${baseUrl}/dashboard/wallet?fawaterak=pending`,
            webhookUrl: `${baseUrl}/api/webhooks/fawaterak_json`,
        },
        list_style: "h",
    };

    const res = await fetch(`${apiUrl}/api/v3/createTransaction`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        body: JSON.stringify(requestBody),
    });

    const resData = await res.json();

    if (!res.ok || resData.status !== "success") {
        console.error("Fawaterak Create Transaction Failed:", resData);
        const msg = resData.message || (resData.errors ? JSON.stringify(resData.errors) : "فشل إنشاء رابط الدفع لدى فواتيرك");
        throw new Error(msg);
    }

    const checkoutUrl = resData.data?.url || resData.data?.short_url;
    const intentKey = resData.data?.intent_key || "";

    if (!checkoutUrl) {
        throw new Error("لم يتم استلام رابط الدفع من فواتيرك");
    }

    return {
        paymentUrl: checkoutUrl,
        intentKey,
    };
}

let cachedVendorKey = "";

export async function getFawaterakVendorKey(): Promise<string> {
    if (process.env.FAWATERAK_VENDOR_KEY) {
        return process.env.FAWATERAK_VENDOR_KEY.trim();
    }
    if (cachedVendorKey) return cachedVendorKey;

    try {
        const { adminDb } = await import("@/lib/firebase/admin");
        const docSnap = await adminDb.collection("settings").doc("fawaterak").get();
        if (docSnap.exists) {
            const key: string = (docSnap.data()?.vendor_key || "").toString().trim();
            cachedVendorKey = key;
            return key;
        }
    } catch (e) {
        // ignore
    }
    return "";
}

/**
 * Verify Fawaterak Webhook HMAC SHA256 Signature
 */
export async function verifyFawaterakWebhookHash({
    transactionId,
    transactionKey,
    paymentMethod,
    receivedHash,
}: {
    transactionId: string | number;
    transactionKey: string;
    paymentMethod: string;
    receivedHash?: string;
}): Promise<boolean> {
    const vendorApiKey = await getFawaterakVendorKey();
    if (!vendorApiKey) {
        // If vendor key is not set, log warning and accept
        console.warn("FAWATERAK_VENDOR_KEY is not configured. Skipping HMAC signature check.");
        return true;
    }

    if (!receivedHash) return false;

    try {
        const stringToSign = `TransactionId=${transactionId}&TransactionKey=${transactionKey}&PaymentMethod=${paymentMethod}`;
        const calculatedHash = crypto
            .createHmac("sha256", vendorApiKey.trim())
            .update(stringToSign)
            .digest("hex");

        return calculatedHash.toLowerCase() === receivedHash.trim().toLowerCase();
    } catch (err) {
        console.error("Error verifying webhook HMAC:", err);
        return false;
    }
}


/**
 * Fetch transaction data from Fawaterak by intentKey
 */
export async function getFawaterakTransactionData(intentKey: string) {
    try {
        const token = await getFawaterakAccessToken();
        const apiUrl = getBaseApiUrl();

        const res = await fetch(`${apiUrl}/api/v3/getTransactionData`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            body: JSON.stringify({ intent_key: intentKey }),
        });

        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        console.error("getFawaterakTransactionData error:", e);
        return null;
    }
}
