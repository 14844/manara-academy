"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { getLabsNext } from "@/components/auth/status-guard"

/** Login <-> signup link that keeps `?next=/labs/...` so a visitor coming from a lab returns to it. */
export function KeepNextLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
    const [target, setTarget] = useState(href)
    useEffect(() => {
        const next = getLabsNext()
        if (next) setTarget(`${href}?next=${encodeURIComponent(next)}`)
    }, [href])
    return <Link href={target} className={className}>{children}</Link>
}
