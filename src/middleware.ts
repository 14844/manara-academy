import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    const session = request.cookies.get('session')?.value
    const path = request.nextUrl.pathname

    // This is a simple middleware. For deep role protection, 
    // we would call the Admin SDK in an API route or Edge Function.
    // However, Edge Functions (middleware) cannot run firebase-admin easily without polyfills.
    // So we'll trust the session cookie for basic protection and handle role logic in the page/layout.

    if (!session && (path.startsWith('/dashboard') || path.startsWith('/instructor') || path.startsWith('/admin') || path.startsWith('/student') || path.startsWith('/learn') || path.startsWith('/pending-approval'))) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    if (session && (path === '/login' || path === '/signup')) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Generate CSP nonce for this request
    const nonce = generateNonce()
    const response = NextResponse.next()

    // Set CSP header with nonce replacing unsafe-inline for script-src
    // Note: style-src keeps 'unsafe-inline' because Next.js injects inline styles
    const csp = [
        `default-src 'self'`,
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://apis.google.com https://www.gstatic.com https://www.youtube.com https://s.ytimg.com`,
        `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
        `img-src 'self' blob: data: https:`,
        `font-src 'self' https://fonts.gstatic.com data:`,
        `frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://drive.google.com https://docs.google.com`,
        `connect-src 'self' https://*.supabase.co https://*.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com wss://*.firebaseio.com https://manara-academy.b-cdn.net https://storage.bunnycdn.com`,
        `media-src 'self' blob: https:`,
        `object-src 'none'`,
        `base-uri 'self'`,
        `form-action 'self'`,
    ].join('; ')

    response.headers.set('Content-Security-Policy', csp)
    response.headers.set('x-nonce', nonce)

    return response
}

/**
 * Generate a cryptographically random nonce for CSP headers.
 * Uses Web Crypto API available in Edge Runtime.
 */
function generateNonce(): string {
    const array = new Uint8Array(16)
    crypto.getRandomValues(array)
    return btoa(String.fromCharCode(...array))
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|html|txt|xml)$).*)',
    ],
}
