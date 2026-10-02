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
        <Header />
        {children}
      </body>
    </html>
  );
}
