import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    const session = request.cookies.get('session')?.value
    const path = request.nextUrl.pathname

    // This is a simple middleware. For deep role protection, 
    // we would call the Admin SDK in an API route or Edge Function.
    // However, Edge Functions (middleware) cannot run firebase-admin easily without polyfills.
    // So we'll trust the session cookie for basic protection and handle role logic in the page/layout.

    if (!session && (path.startsWith('/dashboard') || path.startsWith('/instructor') || path.startsWith('/admin') || path.startsWith('/pending-approval'))) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    if (session && (path === '/login' || path === '/signup')) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    return NextResponse.next()
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
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
