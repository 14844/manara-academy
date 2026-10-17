import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sbetdgjdkpsoykhtpdib.supabase.co'
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNiZXRkZ2pka3Bzb3lraHRwZGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NDIxMzEsImV4cCI6MjA4NzQxODEzMX0.AcM32JezI80SuFVwuaXLS41qWrOYOXMByZ3Go3EO5b4'
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNiZXRkZ2pka3Bzb3lraHRwZGliIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTg0MjEzMSwiZXhwIjoyMDg3NDE4MTMxfQ.p-3FLrGTWHesL1FvQaPprPC1PiqD0tn916b6frXkL6g'

export const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || "manara-academy"

// Client-side Supabase client (respects RLS)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Server-side Supabase Admin client (with service_role key to manage storage & signed URLs securely)
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})
