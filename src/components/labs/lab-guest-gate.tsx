"use client"

import { Suspense, useEffect, useState } from "react"
import { onAuthStateChanged } from "firebase/auth"
import { auth } from "@/lib/firebase/config"
import { LoginForm } from "@/components/auth/login-form"
import { SignupForm } from "@/components/auth/signup-form"
import { FlaskConical } from "lucide-react"

/** Free trial for visitors without an account, counted across all labs (survives reloads). */
const TRIAL_MS = 2 * 60 * 1000
const STORAGE_KEY = "manara_lab_trial_started"

function trialStart(): number {
    try {
        const saved = Number(localStorage.getItem(STORAGE_KEY))
        if (saved > 0 && saved <= Date.now()) return saved
        const now = Date.now()
        localStorage.setItem(STORAGE_KEY, String(now))
        return now
    } catch {
        return Date.now()
    }
}

/**
 * Visitors (not logged in) can use any lab for 2 minutes. Then a blocking overlay asks them to
 * log in or sign up RIGHT HERE — the lab stays mounted underneath, so after auth they continue
 * exactly where they stopped. Logged-in users (active or pending) never see it.
 */
export function LabGuestGate() {
    const [authState, setAuthState] = useState<"loading" | "guest" | "user">("loading")
    const [locked, setLocked] = useState(false)
    const [mode, setMode] = useState<"signup" | "login">("signup")

    useEffect(() => onAuthStateChanged(auth, (u) => setAuthState(u ? "user" : "guest")), [])

    useEffect(() => {
        // Logged-in users never get locked. If the gate is already open, only the form's onSuccess
        // closes it (signup signs in BEFORE the profile is saved, so don't close on the auth event).
        if (authState !== "guest") return
        const remaining = trialStart() + TRIAL_MS - Date.now()
        if (remaining <= 0) {
            setLocked(true)
            return
        }
        const t = setTimeout(() => setLocked(true), remaining)
        return () => clearTimeout(t)
    }, [authState])

    if (!locked) return null

    const unlock = () => setLocked(false)

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-md p-3 font-arabic" dir="rtl" role="dialog" aria-modal="true">
            <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl border bg-card p-5 sm:p-6 shadow-2xl">
                <div className="text-center space-y-2 mb-5">
                    <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                        <FlaskConical className="h-7 w-7 text-primary" />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black">عجبتك التجربة؟ كمّل مجاناً 🔬</h2>
                    <p className="text-sm text-muted-foreground">
                        علشان تكمّل في المعمل اعمل حساب مجاني أو سجّل دخول — وهترجع تكمّل من نفس المكان اللي وقفت فيه.
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-5 p-1 rounded-xl bg-muted">
                    <button
                        type="button"
                        onClick={() => setMode("signup")}
                        className={`rounded-lg py-2 text-sm font-bold transition ${mode === "signup" ? "bg-background shadow" : "text-muted-foreground"}`}
                    >
                        حساب جديد
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode("login")}
                        className={`rounded-lg py-2 text-sm font-bold transition ${mode === "login" ? "bg-background shadow" : "text-muted-foreground"}`}
                    >
                        تسجيل دخول
                    </button>
                </div>

                <Suspense fallback={null}>
                    {mode === "signup" ? <SignupForm studentOnly onSuccess={unlock} /> : <LoginForm onSuccess={unlock} />}
                </Suspense>
            </div>
        </div>
    )
}
