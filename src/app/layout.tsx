import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NEO ACADEMIA — 拠点展開ダッシュボード",
  description:
    "NEO ACADEMIA サテライト拠点の立ち上げ進捗を、トリガーイベント(T1〜T8)の成立を背骨に可視化する社内ダッシュボード。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
