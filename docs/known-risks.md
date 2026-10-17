# Known Risks & Security Architecture Notes

## Content Security Policy (CSP) & `unsafe-eval`

### Status: REMOVED from Production
As of the latest pentest remediation, `'unsafe-eval'` has been completely removed from the CSP `script-src` directive in `next.config.ts`.

### Background & Assessment
1. **Next.js Production Runtime**:
   Next.js pre-compiles all React server components, client components, and JSX templates during `next build`. None of the standard production routes or runtime bundles require dynamic code generation or `eval()`.
2. **Third-Party Integrations**:
   - Google Identity & Firebase Auth: Uses standard DOM postMessage/iframe and JSON communication without eval.
   - YouTube IFrame API: Uses standard postMessage without eval.
   - Secure PDF Viewer: Uses standard DOM rendering without runtime dynamic string evaluation.
3. **Risk Analysis**:
   Leaving `'unsafe-eval'` in production weakens defense-in-depth against DOM-based Cross-Site Scripting (XSS), as any attacker with injection capability could execute arbitrary code strings. Removing `'unsafe-eval'` guarantees that the browser refuses any dynamically evaluated string-to-code execution.

---

## Session Concurrency & Anti-Hijacking (`active_session_id`)

### Status: ENFORCED
- All logins via `/api/auth/session` generate a unique `effectiveSessionId` computed exactly once and stored atomically in `profiles_private/{uid}.active_session_id` and the secure HTTP-only `session_id` cookie.
- Every server-authenticated route invokes `getServerAuth()` which verifies that the incoming request cookie or `x-session-id` header strictly matches `profiles_private.active_session_id`. Any mismatch rejects the request immediately with `401 Unauthorized`.

---

## Storage & Bucket Separation

### Status: ISOLATED
- `SUPABASE_PUBLIC_BUCKET` (`manara-public`): Dedicated strictly to public user avatar images.
- `SUPABASE_BUCKET` (`manara-academy`): Strictly private bucket containing protected educational assets (videos, PDFs, exams, payment receipts). All access requires short-lived signed URLs (15 minutes) or server-mediated streaming through `/api/storage/sign` with active course enrollment verification.
