"use client";

import type { Trigger } from "@/lib/types";

export function Steps({ triggers, onInfo }: { triggers: Trigger[]; onInfo: (t: Trigger) => void }) {
  return (
    <div className="steps">
      {triggers.map((t) => (
        <div
          className="step"
          key={t.code}
          onClick={() => onInfo(t)}
          title={`${t.code} ${t.name} — クリックで成立条件を表示`}
        >
          <span className="sid">{t.code}</span>
          <div className="snm">{t.name}</div>
          <div className="sdc">{t.description}</div>
          <div className="shint">成立条件 ▸</div>
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
      <span style={{ marginLeft: "auto" }}>ステップ帯クリック＝成立条件 ／ カードのドット＝成立を記録</span>
    </div>
  );
}

// 成立条件の詳細モーダル
export function TriggerInfoModal({ trigger, onClose }: { trigger: Trigger; onClose: () => void }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="mhd">
          <div>
            <div className="mk">TRIGGER {trigger.code}</div>
            <h3>{trigger.name}</h3>
          </div>
          <button className="x" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>
        <div className="mbd">
          <label>成立の意味</label>
          <p style={{ fontSize: 13, lineHeight: 1.8 }}>{trigger.description}</p>
          <label>成立条件（この状態が観測できたら成立と記録）</label>
          <p style={{ fontSize: 13, lineHeight: 1.8 }}>{trigger.criteria}</p>
          <p style={{ fontSize: 11, color: "var(--gray)", marginTop: 14, lineHeight: 1.7 }}>
            イベントは「開催した」ではなく成立条件を満たした時点で成立と記録します。記録時には成立日と
            <b>成立の証拠</b>（相手から出た次のアクション提案などの質的メモ）が必須です。
          </p>
        </div>
      </div>
    </div>
  );
}
