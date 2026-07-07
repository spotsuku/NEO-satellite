"use client";

// ルートレイアウト自体が落ちた場合の最終防衛線。
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ja">
      <body style={{ minHeight: "100vh", background: "#0A0A0A", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", padding: 24, margin: 0 }}>
        <div style={{ maxWidth: 560 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>エラーが発生しました</h1>
          <pre style={{ background: "#1a1a1a", border: "1px solid #333", padding: "10px 14px", fontSize: 11, color: "#F03090", whiteSpace: "pre-wrap", wordBreak: "break-all", marginBottom: 14, maxHeight: 160, overflow: "auto" }}>
            {error.message}
            {error.digest ? `\ndigest: ${error.digest}` : ""}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{ background: "#fff", color: "#0A0A0A", border: "none", fontWeight: 700, fontSize: 13, padding: "11px 26px", cursor: "pointer" }}
          >
            再読み込み
          </button>
        </div>
      </body>
    </html>
  );
}
