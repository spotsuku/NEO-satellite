"use client";

// ページ内エラーバウンダリ。白画面ではなく、原因表示と復旧手段を出す。
// デプロイ直後の新旧チャンク不整合（ChunkLoadError 等）は再読み込みで直るため、
// その場合は自動でハードリロードする。

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error);
    // デプロイ跨ぎのチャンク読み込み失敗は自動リロードで復旧
    if (/ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module/i.test(error.message)) {
      window.location.reload();
    }
  }, [error]);

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0A", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans JP', sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 560 }}>
        <div style={{ fontSize: 11, letterSpacing: ".4em", color: "#F0F000", fontFamily: "Montserrat, sans-serif" }}>ERROR</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "8px 0 12px" }}>画面の表示中にエラーが発生しました</h1>
        <p style={{ fontSize: 13, color: "#B0B0B0", lineHeight: 1.8 }}>
          「再読み込み」で直ることがほとんどです（デプロイ直後の更新の食い違いなど）。
          繰り返し発生する場合は、下のエラー内容を開発チームに共有してください。
        </p>
        <pre style={{ background: "#1a1a1a", border: "1px solid #333", padding: "10px 14px", fontSize: 11, color: "#F03090", whiteSpace: "pre-wrap", wordBreak: "break-all", margin: "14px 0", maxHeight: 160, overflow: "auto" }}>
          {error.message}
          {error.digest ? `\ndigest: ${error.digest}` : ""}
        </pre>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => window.location.reload()}
            style={{ background: "#fff", color: "#0A0A0A", border: "none", fontWeight: 700, fontSize: 13, padding: "11px 26px", cursor: "pointer", fontFamily: "'Noto Sans JP', sans-serif" }}
          >
            再読み込み
          </button>
          <button
            onClick={() => reset()}
            style={{ background: "none", color: "#fff", border: "1px solid #555", fontSize: 13, padding: "11px 20px", cursor: "pointer", fontFamily: "'Noto Sans JP', sans-serif" }}
          >
            再試行
          </button>
        </div>
      </div>
    </div>
  );
}
