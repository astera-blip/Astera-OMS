import type { Metadata } from "next";
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
