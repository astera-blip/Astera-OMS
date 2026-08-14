import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { RoleChangeNotice } from "@/components/auth/RoleChangeNotice";
import { StorefrontFooter } from "@/components/storefront/StorefrontFooter";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { RouteFocusManager } from "@/components/accessibility/RouteFocusManager";
import "./globals.css";

export const metadata: Metadata = {
  title: "Astera｜泰國 GL／藝人周邊代購",
  description: "Astera 整理泰國 GL、藝人周邊商品、販售活動、結單時間與銀行匯款流程。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant-TW" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <a className="skip-link" href="#main-content">跳至主要內容</a>
        <AuthProvider>
          <div className="flex min-h-dvh flex-col">
            <StorefrontHeader />
            <RoleChangeNotice />
            <RouteFocusManager>{children}</RouteFocusManager>
            <StorefrontFooter />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
