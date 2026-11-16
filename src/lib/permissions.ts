/**
 * Role-Based Access Control (RBAC) for the admin area.
 *
 * - "admin" keeps EVERY permission (nothing was taken away from the admin).
 * - Staff roles get only the permissions their department needs (least privilege).
 * - Roles are assigned manually in Firestore: profiles/{uid}.role
 *
 * This file is shared by client & server code. It must stay free of server-only imports.
 * If you change a role's permissions here, mirror it in firestore.rules (staff role helpers).
 */

export const PERMISSIONS = [
    "dashboard.view",        // Admin overview page (counts only)
    "analytics.view",        // KPIs page (non-financial numbers)
    "finance.view",          // Revenue / money figures anywhere in the admin area
    "users.view",            // List users (public profile fields)
    "users.view_contact",    // See email / phone / parent phone
    "users.manage_status",   // Approve / reject / suspend / block accounts, reset devices
    "users.verify",          // Toggle instructor verified badge & auto-report unlock
    "wallet.view",           // See wallet balances
    "wallet.adjust",         // Manually recharge / deduct wallet balances
    "payments.manage",       // Review wallet top-up requests, refunds
    "withdrawals.manage",    // Approve / reject instructor withdrawals
    "settlements.view",      // Instructor settlements report
    "courses.view",          // See all courses
    "courses.review",        // Approve / reject pending courses
    "courses.delete",        // Delete courses
    "coupons.manage",        // Create / edit / delete coupons
    "logs.view",             // Activity logs
    "logs.clear",            // Clear activity logs
    "settings.manage",       // Platform settings
] as const

export type Permission = (typeof PERMISSIONS)[number]

export const STAFF_ROLES = [
    "support_team",
    "finance_manager",
    "marketing_team",
    "content_reviewer",
] as const

export type StaffRole = (typeof STAFF_ROLES)[number]
export type UserRole = "student" | "instructor" | "admin" | StaffRole

const ROLE_PERMISSIONS: Record<StaffRole, readonly Permission[]> = {
    // خدمة العملاء: تشوف بيانات المستخدمين وتراجع/تفعّل/تعلّق الحسابات — بدون أي فلوس
    support_team: [
        "dashboard.view",
        "users.view",
        "users.view_contact",
        "users.manage_status",
        "users.verify",
        "courses.view",
    ],
    // المالية: كل ما يخص الفلوس — بدون إدارة الحسابات أو المحتوى
    finance_manager: [
        "dashboard.view",
        "analytics.view",
        "finance.view",
        "users.view",
        "wallet.view",
        "wallet.adjust",
        "payments.manage",
        "withdrawals.manage",
        "settlements.view",
        "courses.view",
    ],
    // التسويق: الكوبونات والأرقام غير المالية
    marketing_team: [
        "dashboard.view",
        "analytics.view",
        "coupons.manage",
        "courses.view",
    ],
    // مراجعة المحتوى: اعتماد أو رفض الكورسات
    content_reviewer: [
        "dashboard.view",
        "courses.view",
        "courses.review",
    ],
}

export const ROLE_LABELS: Record<UserRole, string> = {
    admin: "مدير المنصة",
    instructor: "مدرس",
    student: "طالب",
    support_team: "فريق الدعم",
    finance_manager: "المدير المالي",
    marketing_team: "فريق التسويق",
    content_reviewer: "مراجع المحتوى",
}

export function isStaffRole(role: unknown): role is StaffRole {
    return typeof role === "string" && (STAFF_ROLES as readonly string[]).includes(role)
}

/** True for admin and every staff role — i.e. anyone allowed into /admin. */
export function isBackofficeRole(role: unknown): boolean {
    return role === "admin" || isStaffRole(role)
}

export function getPermissions(role: unknown): readonly Permission[] {
    if (role === "admin") return PERMISSIONS
    if (isStaffRole(role)) return ROLE_PERMISSIONS[role]
    return []
}

export function hasPermission(role: unknown, permission: Permission): boolean {
    if (role === "admin") return true
    if (!isStaffRole(role)) return false
    return ROLE_PERMISSIONS[role].includes(permission)
}

export function hasAnyPermission(role: unknown, permissions: readonly Permission[]): boolean {
    return permissions.some((p) => hasPermission(role, p))
}

export function getRoleLabel(role: unknown): string {
    return (typeof role === "string" && (ROLE_LABELS as Record<string, string>)[role]) || "طالب"
}

/** Where a user should land after login / when hitting the wrong dashboard. */
export function getHomeRouteForRole(role: unknown): string {
    if (isBackofficeRole(role)) return "/admin"
    if (role === "instructor") return "/instructor"
    return "/dashboard"
}

/** Admin-area routes and the permission each one requires. Longest prefix wins. */
export const ADMIN_ROUTE_PERMISSIONS: { href: string; permission: Permission }[] = [
    { href: "/admin/kpis", permission: "analytics.view" },
    { href: "/admin/logs", permission: "logs.view" },
    { href: "/admin/courses", permission: "courses.review" },
    { href: "/admin/users", permission: "users.view" },
    { href: "/admin/all-courses", permission: "courses.view" },
    { href: "/admin/payments", permission: "payments.manage" },
    { href: "/admin/settlements", permission: "settlements.view" },
    { href: "/admin/withdrawals", permission: "withdrawals.manage" },
    { href: "/admin/coupons", permission: "coupons.manage" },
    { href: "/admin/settings", permission: "settings.manage" },
    { href: "/admin", permission: "dashboard.view" },
]

export function getRequiredPermissionForPath(pathname: string): Permission | null {
    const match = ADMIN_ROUTE_PERMISSIONS
        .filter((r) => pathname === r.href || pathname.startsWith(r.href + "/"))
        .sort((a, b) => b.href.length - a.href.length)[0]
    return match ? match.permission : null
}
