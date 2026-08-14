"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

const navigation = [
  { href: "/workspace", label: "工作區 Workspace" },
  { href: "/workspace/products", label: "商品 Products" },
  { href: "/workspace/members", label: "會員 Members" },
  { href: "/workspace/orders", label: "訂單 Orders" },
  { href: "/workspace/payments", label: "付款 Payments" },
  { href: "/workspace/content", label: "內容 Content" },
  { href: "/workspace/audit-logs", label: "稽核紀錄 Audit Logs" },
];

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { role, status, signInWithGoogle } = useAuth();
  const canUseWorkspace = role === "owner";
  const visibleNavigation = navigation;

  if (status === "loading") {
    return (
      <main className="grid min-h-dvh place-items-center bg-astera-page px-5 text-astera-secondary">
        正在載入工作區權限...
      </main>
    );
  }

  if (!canUseWorkspace) {
    return (
      <main className="grid min-h-dvh place-items-center bg-astera-page px-5 text-astera-ink">
        <section className="max-w-md rounded-3xl border border-astera-border bg-astera-surface p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-astera-brand">
            Workspace
          </p>
          <h1 className="mt-2 text-2xl font-semibold">需要後台權限</h1>
          <p className="mt-3 text-sm leading-6 text-astera-secondary">
            {status === "signedIn" && (role === "partner" || role === "helper")
              ? `目前角色為 ${role === "partner" ? "Partner（合作人）" : "Helper（小幫手）"}；此角色的工作區功能將在對應批次開放。`
              : "請使用 Owner 帳號進入工作區。"}
          </p>
          {status === "signedOut" ? (
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              className="mt-5 min-h-11 rounded-full bg-astera-brand px-4 py-2 text-sm font-medium text-white"
            >
              使用 Google 登入
            </button>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-astera-page px-4 py-4 text-astera-ink sm:px-6 lg:px-8">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="rounded-xl border border-astera-border bg-astera-surface px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-astera-service">
                Astera OMS
              </p>
              <h1 className="mt-1 font-serif text-2xl tracking-tight text-astera-ink">
                Owner 營運工作區
              </h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/"
                className="min-h-11 rounded-lg border border-astera-border px-4 py-2 text-sm text-astera-ink transition-colors hover:border-astera-brand hover:bg-astera-brand-soft"
              >
                回到前台
              </Link>
              <Link
                href="/products"
                className="min-h-11 rounded-lg bg-astera-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-astera-ink"
              >
                查看公開商品
              </Link>
            </div>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-astera-border bg-astera-surface p-4 shadow-sm">
            <nav className="grid gap-1">
              {visibleNavigation.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/workspace" && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      "rounded-2xl px-4 py-3 text-sm font-medium transition-colors",
                      active
                        ? "bg-astera-brand text-white"
                        : "text-astera-ink hover:bg-astera-brand-soft",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          <div className="min-w-0">{children}</div>
        </div>
      </section>
    </main>
  );
}
