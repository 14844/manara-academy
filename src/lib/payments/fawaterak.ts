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
    itemName?: string;
    type?: "course_purchase" | "wallet_recharge";
    courseId?: string;
    customSuccessUrl?: string;
    customFailUrl?: string;
    customPendingUrl?: string;
    metadata?: Record<string, any>;
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
    const clientId = process.env.FAWATERAK_CLIENT_ID;
    const clientSecret = process.env.FAWATERAK_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error("بيانات فواتيرك غير مكتملة (يرجى إدخال FAWATERAK_CLIENT_ID و FAWATERAK_CLIENT_SECRET في ملف .env)");
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
export async function createFawaterakTransaction(params: CreateFawaterakSessionParams): Promise<FawaterakSessionResult> {
    const {
        amount,
        customer,
        studentId,
        baseUrl,
        itemName = "شراء دورة تعليمية - أكاديمية المنارة",
        type = "wallet_recharge",
        courseId,
        customSuccessUrl,
        customFailUrl,
        customPendingUrl,
        metadata = {},
    } = params;

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
        type,
        course_id: courseId || null,
        metadata,
        created_at: new Date().toISOString(),
    };

    const successUrl = customSuccessUrl || `${baseUrl}/dashboard/wallet?fawaterak=success&amount=${amount}`;
    const failUrl = customFailUrl || `${baseUrl}/dashboard/wallet?fawaterak=failed`;
    const pendingUrl = customPendingUrl || `${baseUrl}/dashboard/wallet?fawaterak=pending`;

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
                name: itemName,
                price: Number(amount),
                quantity: 1,
            },
        ],
        pay_load: payloadData,
        redirectionUrls: {
            successUrl,
            failUrl,
            pendingUrl,
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
    return process.env.FAWATERAK_VENDOR_KEY ? process.env.FAWATERAK_VENDOR_KEY.trim() : "";
}

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
        throw new Error("VENDOR_KEY_NOT_CONFIGURED");
    }

    if (!receivedHash || !transactionId || !transactionKey) return false;

    try {
        const stringToSign = `TransactionId=${transactionId}&TransactionKey=${transactionKey}&PaymentMethod=${paymentMethod}`;
        const calculatedHash = crypto
            .createHmac("sha256", vendorApiKey.trim())
            .update(stringToSign)
            .digest("hex")
            .toLowerCase();

        const receivedNormalized = receivedHash.trim().toLowerCase();

        // Constant-time comparison to prevent timing side-channel attacks
        if (calculatedHash.length !== receivedNormalized.length) return false;
        const a = Buffer.from(calculatedHash, "utf-8");
        const b = Buffer.from(receivedNormalized, "utf-8");
        return crypto.timingSafeEqual(a, b);
    } catch {
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
