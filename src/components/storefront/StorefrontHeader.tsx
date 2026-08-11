"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountActions } from "@/components/auth/AccountActions";

export function StorefrontHeader() {
  const pathname = usePathname();

  if (pathname.startsWith("/workspace") || pathname === "/ux-acceptance") {
    return null;
  }

  return (
    <header className="border-b border-astera-border bg-astera-surface px-4 py-3 sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-5 gap-y-2">
        <Link href="/" className="inline-flex min-h-11 items-center font-serif text-xl tracking-[0.14em] text-astera-ink">ASTERA</Link>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-x-2 gap-y-2">
          <nav aria-label="公開導覽" className="flex flex-wrap items-center justify-end gap-1 text-sm font-medium text-astera-ink">
            <Link href="/products" className="inline-flex min-h-11 items-center rounded-lg px-3 transition-colors hover:bg-astera-brand-soft">商品</Link>
            <Link href="/brand#campaigns" className="inline-flex min-h-11 items-center rounded-lg px-3 transition-colors hover:bg-astera-brand-soft">Campaign／品牌</Link>
            <Link href="/brand#faq" className="inline-flex min-h-11 items-center rounded-lg px-3 transition-colors hover:bg-astera-brand-soft">FAQ／客服</Link>
            <Link href="/cart" className="inline-flex min-h-11 items-center rounded-lg px-3 transition-colors hover:bg-astera-brand-soft">購物車</Link>
          </nav>
          <AccountActions />
        </div>
      </div>
    </header>
  );
}
