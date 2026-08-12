"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";

export function AccountActions({
  variant = "desktop",
  onNavigate,
}: {
  variant?: "desktop" | "mobile";
  onNavigate?: () => void;
}) {
  const { status, user, role, error, signInWithGoogle, signOut } = useAuth();
  const isMobile = variant === "mobile";
  const itemClassName = isMobile
    ? "flex min-h-11 items-center border-b border-astera-border px-1 text-sm font-medium text-astera-ink"
    : "inline-flex min-h-11 items-center rounded-lg px-3 font-medium text-astera-ink transition-colors hover:bg-astera-brand-soft";

  if (status === "loading") {
    return <span aria-live="polite" className={isMobile ? "flex min-h-11 items-center px-1 text-sm text-astera-secondary" : "inline-flex min-h-11 items-center text-sm text-astera-secondary"}>載入登入狀態…</span>;
  }

  if (status === "signedOut") {
    return (
      <div className={isMobile ? "grid gap-2 pt-2" : "flex flex-col items-end gap-1"}>
        <button
          type="button"
          onClick={() => void signInWithGoogle()}
          className={isMobile ? "inline-flex min-h-11 items-center justify-center rounded-lg bg-astera-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-astera-ink" : "inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-astera-ink transition-colors hover:bg-astera-brand-soft"}
        >
          使用 Google 登入
        </button>
        {error ? <p aria-live="polite" role="alert" className="max-w-xs text-xs text-red-700">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className={isMobile ? "grid" : "flex flex-wrap items-center justify-end gap-2 text-sm"}>
      {isMobile ? <p className="min-h-11 border-b border-astera-border px-1 pt-3 text-sm text-astera-secondary">您好，{user?.displayName || "會員"}</p> : null}
      {role === "owner" ? <Link href="/workspace" onClick={onNavigate} className={itemClassName}>管理後台</Link> : null}
      <Link href="/orders" onClick={onNavigate} className={itemClassName}>我的訂單</Link>
      <Link href="/account/profile" onClick={onNavigate} className={itemClassName}>{isMobile ? "我的帳號" : user?.displayName || "會員資料"}</Link>
      <button
        type="button"
        onClick={() => void signOut().then(onNavigate)}
        className={isMobile ? "min-h-11 px-1 text-left text-sm font-medium text-astera-secondary" : "min-h-11 rounded-lg border border-astera-border bg-astera-surface px-4 font-semibold text-astera-ink transition-colors hover:border-astera-brand hover:bg-astera-brand-soft"}
      >
        登出
      </button>
    </div>
  );
}
