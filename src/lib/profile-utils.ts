import { db } from "./firebase/config"
import { doc, runTransaction, increment } from "firebase/firestore"

export async function generateUniqueStudentId() {
    return await runTransaction(db, async (transaction) => {
        const statsRef = doc(db, "system", "stats")
        const statsSnap = await transaction.get(statsRef)

        let nextId = 1001
        if (statsSnap.exists()) {
            nextId = (statsSnap.data().last_student_number || 1000) + 1
        }

        transaction.set(statsRef, { last_student_number: nextId }, { merge: true })

        return `MANARA-${nextId}`
    })
}

export async function initializeWallet(userId: string) {
    const profileRef = doc(db, "profiles", userId)
    await runTransaction(db, async (transaction) => {
        transaction.update(profileRef, {
            wallet_balance: 0
        })
    })
}
