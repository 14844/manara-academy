import { POST as supabaseUpload } from "../supabase/route"

export const runtime = 'nodejs'

/**
 * Backwards compatibility route: delegates upload directly to Supabase Storage
 */
export const POST = supabaseUpload
