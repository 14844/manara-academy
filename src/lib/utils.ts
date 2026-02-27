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
