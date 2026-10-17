import { createClient } from '@supabase/supabase-js'

if (typeof window !== 'undefined') {
    throw new Error("supabase/admin cannot be imported in client-side code")
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase admin configuration missing: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not defined in environment variables.")
}

export const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || "manara-academy"

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})
