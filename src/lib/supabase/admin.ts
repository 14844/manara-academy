import { createClient } from '@supabase/supabase-js'

export const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || "manara-academy"
export const SUPABASE_PUBLIC_BUCKET = process.env.SUPABASE_PUBLIC_BUCKET || "manara-public"

let _client: ReturnType<typeof createClient> | null = null

export function getSupabaseAdmin() {
    if (typeof window !== 'undefined') {
        throw new Error("supabase/admin cannot be imported in client-side code")
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error("Supabase admin configuration missing: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not defined in environment variables.")
    }

    if (!_client) {
        _client = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        })
    }
    return _client
}

// Proxy allows `supabaseAdmin.storage...` to be safely imported at build time without throwing when env vars are pending
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createClient>, {
    get(_target, prop) {
        const client = getSupabaseAdmin()
        const value = (client as any)[prop]
        if (typeof value === 'function') {
            return value.bind(client)
        }
        return value
    }
})
