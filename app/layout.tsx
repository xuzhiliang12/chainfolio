import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chainfolio — 链上资产看板",
  description: "跨账户、跨链的只读资产监控看板。",
  icons: {
    icon: "/brand/chainfolio-favicon.svg",
    shortcut: "/brand/chainfolio-favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
