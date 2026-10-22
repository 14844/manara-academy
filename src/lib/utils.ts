import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sanitizeFilename(filename: string): string {
  // Extract extension
  const parts = filename.split('.')
  const ext = parts.length > 1 ? parts.pop() : ''
  const name = parts.join('.')

  // Remove non-alphanumeric characters (except dots and dashes)
  // We'll replace them with underscores
  const sanitized = name
    .normalize("NFD") // Normalize to handle some accents
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-zA-Z0-9.\-_]/g, '_') // Replace EVERYTHING else with _
    .replace(/_{2,}/g, '_') // Replace multiple underscores with one
    .slice(0, 100) // Limit name length to 100 chars

  return ext ? `${sanitized}.${ext}` : sanitized
}

export function getCourseThumbnailUrl(url?: string | null): string {
  const fallback = "https://images.unsplash.com/photo-1501504905252-473c47e087f8?q=80&w=2074&auto=format&fit=crop"
  if (!url || typeof url !== "string" || !url.trim()) return fallback

  // If it's a Supabase thumbnail (signed or raw), convert to permanent non-expiring route
  if (url.includes("/thumbnails/")) {
    const rawPath = url.split("/thumbnails/")[1]?.split("?")[0]
    if (rawPath) {
      return `/api/storage/thumbnail?path=thumbnails/${rawPath}`
    }
  }

  return url
}
