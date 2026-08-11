"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";

export function StorefrontHeader() {
  const pathname = usePathname();
  const { user, signInWithGoogle, signOut } = useAuth();

  if (pathname.startsWith("/workspace") || pathname === "/ux-acceptance") {
    return null;
  }

  return (
    <header className="border-b border-[#DED7D6] bg-[#F7F3F2]/95 px-5 py-3 backdrop-blur sm:px-8">
      <div className="mx-auto flex min-h-14 max-w-7xl flex-wrap items-center justify-between gap-3">
        <Link href="/" className="min-h-11 inline-flex items-center font-serif text-xl tracking-[0.08em] text-[#20242B]">
          ASTERA OMS
        </Link>
        <nav aria-label="公開導覽" className="flex flex-wrap items-center gap-1 text-sm font-medium text-[#20242B]">
          <Link href="/products" className="min-h-11 inline-flex items-center rounded-full px-3 hover:bg-[#E7DDDF]">商品</Link>
          <Link href="/brand#campaigns" className="min-h-11 inline-flex items-center rounded-full px-3 hover:bg-[#E7DDDF]">Campaign／品牌</Link>
          <Link href="/brand#faq" className="min-h-11 inline-flex items-center rounded-full px-3 hover:bg-[#E7DDDF]">FAQ／客服</Link>
          <Link href="/cart" className="min-h-11 inline-flex items-center rounded-full px-3 hover:bg-[#E7DDDF]">購物車</Link>
          {user ? (
            <>
              <Link href="/account/profile" className="min-h-11 inline-flex items-center rounded-full px-3 hover:bg-[#E7DDDF]">會員</Link>
              <Link href="/account/bank-accounts" className="min-h-11 inline-flex items-center rounded-full px-3 hover:bg-[#E7DDDF]">匯款帳戶</Link>
              <Link href="/payments" className="min-h-11 inline-flex items-center rounded-full px-3 hover:bg-[#E7DDDF]">付款回報</Link>
              <button type="button" onClick={() => void signOut()} className="min-h-11 rounded-full border border-[#DED7D6] px-3 hover:bg-white">登出</button>
            </>
          ) : (
            <button type="button" onClick={() => void signInWithGoogle()} className="min-h-11 rounded-full bg-[#6E4E64] px-4 text-white hover:opacity-90">Google 登入</button>
          )}
        </nav>
      </div>
    </header>
  );
}
