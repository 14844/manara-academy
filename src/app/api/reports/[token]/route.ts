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
        return NextResponse.json(data)
    } catch (error: any) {
        console.error("Error in parent reports API:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
