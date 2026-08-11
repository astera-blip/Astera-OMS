import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { StorefrontFooter } from "@/components/storefront/StorefrontFooter";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { RouteFocusManager } from "@/components/accessibility/RouteFocusManager";
import "./globals.css";

export const metadata: Metadata = {
  title: "Astera OMS | Operations Workspace",
  description: "Astera OMS operations workspace for preorder commerce and internal work.",
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
            <RouteFocusManager>{children}</RouteFocusManager>
            <StorefrontFooter />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
