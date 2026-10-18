import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
export const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || "manara-academy"
export const SUPABASE_PUBLIC_BUCKET = SUPABASE_BUCKET

// Safe fallback for static build time analysis when env vars are not yet populated in CI/Vercel
const safeUrl = SUPABASE_URL || "https://placeholder.supabase.co"
const safeKey = SUPABASE_ANON_KEY || "placeholder"

// Client-safe Supabase client (only uses public anon key and respects RLS)
export const supabase = createClient(safeUrl, safeKey)
