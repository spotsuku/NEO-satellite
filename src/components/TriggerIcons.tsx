"use client";

// トリガー別ピクトグラム（すごろくマス用）。
// ブランド規定: 面塗りは白/黒のみ、ネオンは線・ドットのみ → stroke ベースの線画。
export default function TriggerIcon({ code, accent }: { code: string; accent: string }) {
  const s = {
    stroke: "var(--ink)",
    strokeWidth: 2,
    fill: "none",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const a = { ...s, stroke: accent };

  switch (code) {
    case "T1": // 地域の紹介役合意 — 顔役と握手
      return (
        <svg viewBox="0 0 32 32" width="44" height="44" aria-hidden>
          <circle cx="9" cy="9" r="4" {...s} />
          <circle cx="23" cy="9" r="4" {...s} />
          <path d="M3 26 C4 20 7 17 9 17 C11 17 12 19 16 21" {...s} />
          <path d="M29 26 C28 20 25 17 23 17 C21 17 20 19 16 21" {...s} />
          <circle cx="16" cy="21" r="2" {...a} />
        </svg>
      );
    case "T2": // 現地立上げ戦略会議 — 乾杯ジョッキ
      return (
        <svg viewBox="0 0 32 32" width="44" height="44" aria-hidden>
          <path d="M9 10 H21 V26 H9 Z" {...s} />
          <path d="M21 13 H25 V22 H21" {...s} />
          <path d="M12 14 V22 M15 14 V22 M18 14 V22" {...s} strokeWidth={1.4} />
          <circle cx="11" cy="7" r="1.6" {...a} />
          <circle cx="16" cy="5.5" r="1.6" {...a} />
          <circle cx="21" cy="7" r="1.6" {...a} />
        </svg>
      );
    case "T3": // 事務局リーダー確定 — 旗を振る若手
      return (
        <svg viewBox="0 0 32 32" width="44" height="44" aria-hidden>
          <circle cx="13" cy="12" r="4" {...s} />
          <path d="M7 28 C7.5 22 10 19.5 13 19.5 C16 19.5 18.5 22 19 28" {...s} />
          <path d="M18 15 L23 8" {...s} />
          <path d="M23 3 V8" {...a} />
          <path d="M23 3 H30 L27.8 5.2 L30 7.4 H23" {...a} />
        </svg>
      );
    case "T4": // 準備室発足 — 部屋に5ロール
      return (
        <svg viewBox="0 0 32 32" width="44" height="44" aria-hidden>
          <path d="M4 14 L16 5 L28 14 V27 H4 Z" {...s} />
          <circle cx="9" cy="21" r="1.8" {...a} />
          <circle cx="12.5" cy="21" r="1.8" {...a} />
          <circle cx="16" cy="21" r="1.8" {...a} />
          <circle cx="19.5" cy="21" r="1.8" {...a} />
          <circle cx="23" cy="21" r="1.8" {...a} />
        </svg>
      );
    case "T5": // 現地説明会 — メガホン
      return (
        <svg viewBox="0 0 32 32" width="44" height="44" aria-hidden>
          <path d="M5 13 L19 6 V24 L5 17 Z" {...s} />
          <path d="M8 18 V23 C8 24.5 9 25.5 10.5 25.5 C12 25.5 12.5 24.5 12.5 23" {...s} />
          <path d="M23 11 C25 13 25 17 23 19" {...a} />
          <path d="M26 8 C29.5 11.5 29.5 18.5 26 22" {...a} />
        </svg>
      );
    case "T6": // オーナー候補トップ会談 — 対面の2人
      return (
        <svg viewBox="0 0 32 32" width="44" height="44" aria-hidden>
          <circle cx="8" cy="10" r="4" {...s} />
          <circle cx="24" cy="10" r="4" {...s} />
          <path d="M2 27 C3 20 5.5 18 8 18 C10.5 18 12 20 13 22" {...s} />
          <path d="M30 27 C29 20 26.5 18 24 18 C21.5 18 20 20 19 22" {...s} />
          <path d="M12 25 H20" {...a} />
          <circle cx="16" cy="25" r="1.5" {...a} />
        </svg>
      );
    case "T7": // 1社目調印式 — 契約書と押印
      return (
        <svg viewBox="0 0 32 32" width="44" height="44" aria-hidden>
          <path d="M8 4 H24 V28 H8 Z" {...s} />
          <path d="M11 9 H21 M11 13 H21 M11 17 H17" {...s} strokeWidth={1.4} />
          <circle cx="20" cy="23" r="3.6" {...a} />
          <circle cx="20" cy="23" r="1.2" {...a} />
        </svg>
      );
    case "T8": // 加盟金3000万円達成 — ¥コイン
      return (
        <svg viewBox="0 0 32 32" width="44" height="44" aria-hidden>
          <circle cx="16" cy="16" r="12" {...s} />
          <path d="M11 9 L16 16 L21 9 M16 16 V24 M12 17.5 H20 M12 21 H20" {...a} />
        </svg>
      );
    case "T9": // キックオフ（開校）— ゴールフラッグ
      return (
        <svg viewBox="0 0 32 32" width="44" height="44" aria-hidden>
          <path d="M9 28 V4" {...s} />
          <path d="M9 5 H25 L20.5 10 L25 15 H9" {...s} />
          <circle cx="9" cy="28" r="2" {...a} />
          <path d="M13 7.5 H17 M13 12 H17" {...a} strokeWidth={1.4} />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 32 32" width="44" height="44" aria-hidden>
          <circle cx="16" cy="16" r="10" {...s} />
        </svg>
      );
  }
}
