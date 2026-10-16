import { NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase/admin"

export async function GET(
    request: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params

        if (!token) {
            return NextResponse.json({ error: "Missing token parameter" }, { status: 400 })
        }

        const docRef = adminDb.collection("parent_reports").doc(token)
        const docSnap = await docRef.get()

        if (!docSnap.exists) {
            return NextResponse.json({ error: "Report not found" }, { status: 404 })
        }

        const data = docSnap.data()

        // Verify token expiration (default 60 days max if expires_at not explicitly set)
        if (data?.expires_at) {
            if (new Date(data.expires_at).getTime() < Date.now()) {
                return NextResponse.json({ error: "انتهت صلاحية رابط هذا التقرير" }, { status: 410 })
            }
        } else if (data?.created_at) {
            const createdAtTime = new Date(data.created_at).getTime()
            if (Date.now() - createdAtTime > 60 * 24 * 60 * 60 * 1000) {
                return NextResponse.json({ error: "انتهت صلاحية رابط هذا التقرير" }, { status: 410 })
            }
        }

        return NextResponse.json(data)
    } catch (error: any) {
        console.error("Error in parent reports API:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
