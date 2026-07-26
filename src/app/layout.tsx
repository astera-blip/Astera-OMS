import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { StorefrontFooter } from "@/components/storefront/StorefrontFooter";
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
        <AuthProvider>
          <div className="flex min-h-screen flex-col">
            <div className="flex-1">{children}</div>
            <StorefrontFooter />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
