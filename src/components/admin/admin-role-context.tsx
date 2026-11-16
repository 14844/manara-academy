"use client"

import { createContext, useContext, useMemo } from "react"
import {
    getRoleLabel,
    hasPermission,
    isBackofficeRole,
    type Permission,
    type UserRole,
} from "@/lib/permissions"

export interface AdminRoleContextValue {
    /** The signed-in backoffice user's role (admin or a staff role). null until resolved. */
    role: UserRole | null
    /** Arabic label of the role, e.g. "مدير المنصة" / "فريق الدعم". */
    roleLabel: string
    isAdmin: boolean
    /** Does the current user hold this permission? (admin → always true) */
    can: (permission: Permission) => boolean
}

const AdminRoleContext = createContext<AdminRoleContextValue>({
    role: null,
    roleLabel: "",
    isAdmin: false,
    can: () => false,
})

export function AdminRoleProvider({ role, children }: { role: UserRole | null; children: React.ReactNode }) {
    const value = useMemo<AdminRoleContextValue>(() => {
        const effectiveRole = isBackofficeRole(role) ? role : null
        return {
            role: effectiveRole,
            roleLabel: effectiveRole ? getRoleLabel(effectiveRole) : "",
            isAdmin: effectiveRole === "admin",
            can: (permission: Permission) => hasPermission(effectiveRole, permission),
        }
    }, [role])

    return <AdminRoleContext.Provider value={value}>{children}</AdminRoleContext.Provider>
}

export function useAdminRole(): AdminRoleContextValue {
    return useContext(AdminRoleContext)
}
