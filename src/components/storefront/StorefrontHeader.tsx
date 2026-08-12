"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AccountActions } from "@/components/auth/AccountActions";
import { HeaderCartDrawer } from "@/components/storefront/HeaderCartDrawer";

export function StorefrontHeader() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
        setIsCartDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (pathname.startsWith("/workspace") || pathname === "/ux-acceptance") {
    return null;
  }

  return (
    <header className="relative border-b border-astera-border bg-astera-surface px-4 py-2 sm:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <Link href="/" className="inline-flex min-h-11 items-center font-serif text-xl tracking-[0.14em] text-astera-ink">ASTERA</Link>
        <div className="hidden min-w-0 flex-1 items-center justify-end gap-x-2 md:flex">
          <nav aria-label="公開導覽" className="flex items-center justify-end gap-1 text-sm font-medium text-astera-ink">
            <Link href="/products" onClick={() => setIsMobileMenuOpen(false)} className="inline-flex min-h-11 items-center rounded-lg px-3 transition-colors hover:bg-astera-brand-soft">商品</Link>
            <Link href="/brand#campaigns" onClick={() => setIsMobileMenuOpen(false)} className="inline-flex min-h-11 items-center rounded-lg px-3 transition-colors hover:bg-astera-brand-soft">品牌</Link>
            <Link href="/brand#faq" onClick={() => setIsMobileMenuOpen(false)} className="inline-flex min-h-11 items-center rounded-lg px-3 transition-colors hover:bg-astera-brand-soft">常見問題</Link>
          </nav>
          <button type="button" onClick={() => setIsCartDrawerOpen(true)} className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-astera-ink transition-colors hover:bg-astera-brand-soft">購物車</button>
          <AccountActions />
        </div>
        <div className="flex items-center gap-1 md:hidden">
          <button type="button" onClick={() => setIsCartDrawerOpen(true)} className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-astera-ink transition-colors hover:bg-astera-brand-soft">購物車</button>
          <button
            type="button"
            aria-label="開啟選單"
            aria-expanded={isMobileMenuOpen}
            aria-controls="storefront-mobile-menu"
            onClick={() => setIsMobileMenuOpen((current) => !current)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-astera-border text-lg text-astera-ink"
          >
            ☰
          </button>
        </div>
      </div>
      <nav id="storefront-mobile-menu" aria-label="會員導覽" hidden={!isMobileMenuOpen} className="mx-auto mt-2 grid max-w-7xl border-t border-astera-border pt-2 md:hidden">
        <Link href="/products" onClick={() => setIsMobileMenuOpen(false)} className="flex min-h-11 items-center border-b border-astera-border px-1 text-sm font-medium text-astera-ink">商品</Link>
        <Link href="/brand#campaigns" onClick={() => setIsMobileMenuOpen(false)} className="flex min-h-11 items-center border-b border-astera-border px-1 text-sm font-medium text-astera-ink">品牌</Link>
        <Link href="/brand#faq" onClick={() => setIsMobileMenuOpen(false)} className="flex min-h-11 items-center border-b border-astera-border px-1 text-sm font-medium text-astera-ink">常見問題</Link>
        <AccountActions variant="mobile" onNavigate={() => setIsMobileMenuOpen(false)} />
      </nav>
      <HeaderCartDrawer open={isCartDrawerOpen} onClose={() => setIsCartDrawerOpen(false)} />
    </header>
  );
}
