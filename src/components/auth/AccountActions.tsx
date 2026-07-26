"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";

export function AccountActions() {
  const { status, user, error, signInWithGoogle, signOut } = useAuth();

  if (status === "loading") {
    return <span className="text-sm text-slate-500">載入登入狀態...</span>;
  }

  if (status === "signedOut") {
    return (
      <div className="flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={() => void signInWithGoogle()}
          className="inline-flex h-10 items-center border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50"
        >
          使用 Google 登入
        </button>
        {error ? <p className="text-xs text-red-700">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-3 text-sm">
      <Link href="/account/profile" className="font-medium text-slate-700 hover:text-slate-950">
        {user?.displayName || "會員資料"}
      </Link>
      <button
        type="button"
        onClick={() => void signOut()}
        className="h-10 border border-slate-300 bg-white px-4 font-semibold text-slate-900 transition-colors hover:bg-slate-50"
      >
        登出
      </button>
    </div>
  );
}
