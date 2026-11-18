/**
 * Escapes a value for safe interpolation into an HTML string (text content or
 * quoted attribute values). Use for every data-derived value inserted into
 * HTML built with template strings (print windows, document.write, innerHTML).
 */
export function escapeHtml(value: unknown): string {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
}
