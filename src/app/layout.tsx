import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "MANGAI Creator Platform",
  description: "AIクリエイター向け作品販売プラットフォーム"
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className="min-h-screen">
        <Header />
        {children}
      </body>
    </html>
  );
}
