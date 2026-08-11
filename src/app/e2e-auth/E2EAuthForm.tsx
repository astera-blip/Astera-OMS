"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

export function E2EAuthForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("E2E auth helper ready.");

  async function signIn() {
    try {
      const [{ auth }, { signInWithEmailAndPassword }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("firebase/auth"),
      ]);

      await signInWithEmailAndPassword(auth, email, password);
      window.location.assign(searchParams.get("next") ?? "/");
    } catch {
      setMessage("E2E sign-in failed.");
    }
  }

  return (
    <main className="mx-auto grid max-w-md gap-4 p-8">
      <h1 className="text-2xl font-semibold">E2E Test Auth</h1>
      <label className="grid gap-2 text-sm">
        <span>Email</span>
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="rounded-2xl border border-slate-300 px-4 py-3"
        />
      </label>
      <label className="grid gap-2 text-sm">
        <span>Password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="rounded-2xl border border-slate-300 px-4 py-3"
        />
      </label>
      <button
        type="button"
        onClick={() => void signIn()}
        className="rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
      >
        Sign in
      </button>
      <p className="text-sm text-slate-600">{message}</p>
    </main>
  );
}
