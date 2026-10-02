import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "MANGAI | インディーズ漫画のデジタル書店",
  description: "個性豊かなインディーズ漫画を探して、試し読みから購入まで楽しめるデジタル書店"
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className="min-h-screen">
        <a
          className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-md bg-violet-800 px-4 py-3 font-bold text-white transition focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 motion-reduce:transition-none"
          href="#main-content"
        >
          本文へ移動
        </a>
        <Header />
        <div className="focus:outline-none" id="main-content" tabIndex={-1}>
          {children}
        </div>
      </body>
    </html>
  );
}
