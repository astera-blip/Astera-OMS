import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Astera OMS",
  description: "Thai GL merchandise preorder and operations system.",
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
