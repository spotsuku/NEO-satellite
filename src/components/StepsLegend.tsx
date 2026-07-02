"use client";

import type { Trigger } from "@/lib/types";

export function Steps({ triggers }: { triggers: Trigger[] }) {
  return (
    <div className="steps">
      {triggers.map((t) => (
        <div className="step" key={t.code}>
          <span className="sid">{t.code}</span>
          <div className="snm">{t.name}</div>
          <div className="sdc">{t.description}</div>
        </div>
      ))}
    </div>
  );
}

export function Legend() {
  return (
    <div className="legend">
      <span>
        <span className="dot done" />
        成立済み
      </span>
      <span>
        <span className="dot now" />
        次のトリガー（準備中）
      </span>
      <span>
        <span className="dot fut" />
        未到達
      </span>
      <span style={{ color: "var(--gray)" }}>県の黒塗り＝トリガー進捗（成立数/8）</span>
      <span style={{ marginLeft: "auto" }}>カードをクリックで詳細を表示</span>
    </div>
  );
}
