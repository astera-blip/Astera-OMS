"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";

export function AccountActions() {
  const { status, user, error, signInWithGoogle, signOut } = useAuth();

  if (status === "loading") {
    return <span aria-live="polite" className="inline-flex min-h-11 items-center text-sm text-astera-secondary">載入登入狀態…</span>;
  }

  if (status === "signedOut") {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => void signInWithGoogle()}
          className="inline-flex min-h-11 items-center rounded-lg bg-astera-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-astera-ink"
        >
          使用 Google 登入
        </button>
        {error ? <p aria-live="polite" role="alert" className="max-w-xs text-xs text-red-700">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
      <Link href="/account/profile" className="inline-flex min-h-11 items-center rounded-lg px-3 font-medium text-astera-ink transition-colors hover:bg-astera-brand-soft">
        {user?.displayName || "會員資料"}
      </Link>
      <button
        type="button"
        onClick={() => void signOut()}
        className="min-h-11 rounded-lg border border-astera-border bg-astera-surface px-4 font-semibold text-astera-ink transition-colors hover:border-astera-brand hover:bg-astera-brand-soft"
      >
        登出
      </button>
    </div>
  );
}
