const PAYMOB_API_URL = "https://egypt.paymob.com/api"

export async function createPaymobOrder(amount: number, userEmail: string, userPhone: string) {
    try {
        // 1. Authentication Request
        const authRes = await fetch(`${PAYMOB_API_URL}/auth/tokens`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: process.env.PAYMOB_API_KEY })
        })
        const { token } = await authRes.json()

        // 2. Order Registration
        const orderRes = await fetch(`${PAYMOB_API_URL}/ecommerce/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                auth_token: token,
                delivery_needed: "false",
                amount_cents: amount * 100,
                currency: "EGP",
                items: []
            })
        })
        const order = await orderRes.json()

        // 3. Payment Key Generation
        const keyRes = await fetch(`${PAYMOB_API_URL}/acceptance/payment_keys`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                auth_token: token,
                amount_cents: amount * 100,
                expiration: 3600,
                order_id: order.id,
                billing_data: {
                    apartment: "NA",
                    email: userEmail,
                    floor: "NA",
                    first_name: "Student",
                    street: "NA",
                    building: "NA",
                    phone_number: userPhone,
                    shipping_method: "NA",
                    postal_code: "NA",
                    city: "NA",
                    country: "EG",
                    last_name: "User",
                    state: "NA"
                },
                currency: "EGP",
                integration_id: process.env.PAYMOB_INTEGRATION_ID_CARD,
                lock_order_when_paid: "false"
            })
        })
        const { token: paymentKey } = await keyRes.json()

        return {
            paymentUrl: `https://egypt.paymob.com/api/acceptance/iframes/${process.env.PAYMOB_IFRAME_ID}?payment_token=${paymentKey}`,
            orderId: order.id
        }
    } catch (error) {
        console.error("Paymob Error:", error)
        throw new Error("Failed to initiate payment")
    }
}
