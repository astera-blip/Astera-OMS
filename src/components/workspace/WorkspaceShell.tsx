"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

const navigation = [
  { href: "/workspace", label: "Workspace" },
  { href: "/workspace/products", label: "Products" },
  { href: "/workspace/members", label: "Members" },
  { href: "/workspace/orders", label: "Orders" },
  { href: "/workspace/payments", label: "Payments" },
  { href: "/workspace/content", label: "Content" },
  { href: "/workspace/audit-logs", label: "Audit Logs" },
];

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { role, status, signInWithGoogle } = useAuth();
  const canUseWorkspace = role === "owner" || role === "helper";
  const visibleNavigation = navigation.filter((item) => {
    if (role === "owner") {
      return true;
    }

    return !["/workspace/members", "/workspace/payments", "/workspace/audit-logs"].includes(
      item.href,
    );
  });

  if (status === "loading") {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-5 text-slate-700">
        正在載入工作區權限...
      </main>
    );
  }

  if (!canUseWorkspace) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-5 text-slate-900">
        <section className="max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
            Workspace
          </p>
          <h1 className="mt-2 text-2xl font-semibold">需要後台權限</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            請使用 owner 或 helper 帳號進入工作區。
          </p>
          {status === "signedOut" ? (
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              className="mt-5 rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white"
            >
              使用 Google 登入
            </button>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#0f172a_0%,#111827_35%,#f8fafc_35%,#f8fafc_100%)] px-4 py-4 text-slate-900 sm:px-6 lg:px-8">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="rounded-3xl border border-white/10 bg-slate-950 px-5 py-4 text-white shadow-lg shadow-slate-950/15">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">
                Astera OMS
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                Operations Workspace
              </h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/"
                className="rounded-full border border-white/15 px-4 py-2 text-sm text-slate-100 transition-colors hover:bg-white/10"
              >
                Home
              </Link>
              <Link
                href="/products"
                className="rounded-full bg-amber-400 px-4 py-2 text-sm font-medium text-slate-950 transition-colors hover:bg-amber-300"
              >
                Public Products
              </Link>
            </div>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
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
                        ? "bg-slate-950 text-white"
                        : "text-slate-700 hover:bg-slate-100",
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
