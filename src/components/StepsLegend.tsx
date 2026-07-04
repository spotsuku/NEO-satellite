"use client";

import type { Trigger } from "@/lib/types";
import TriggerChecklist from "./TriggerChecklist";
import TriggerIcon from "./TriggerIcons";

const ACCENTS = ["var(--yellow)", "var(--pink)", "var(--cyan)", "var(--green)"];

// すごろく型ステップ帯: イラスト（ピクトグラム）＋タイトル＋説明のマスを矢印でつなぐ
export function Steps({ triggers, onInfo }: { triggers: Trigger[]; onInfo: (t: Trigger) => void }) {
  const last = triggers.length - 1;
  return (
    <div className="sugo">
      {triggers.map((t, i) => {
        const accent = ACCENTS[i % ACCENTS.length];
        return (
          <div
            className="sq"
            key={t.code}
            onClick={() => onInfo(t)}
            title={`${t.code} ${t.name} — クリックで成立条件を表示`}
            style={{ ["--sq-accent" as string]: accent }}
          >
            {i === 0 && <span className="tag">START</span>}
            {i === last && <span className="tag goal">GOAL</span>}
            <span className="num">{t.code}</span>
            <span className="icon">
              <TriggerIcon code={t.code} accent={accent} />
            </span>
            <div className="snm">{t.name}</div>
            <div className="sdc">{t.description}</div>
            <div className="shint">成立条件 ▸</div>
            {i < last && <span className="arrow">▶</span>}
          </div>
        );
      })}
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
          <p style={{ fontSize: 13, lineHeight: 1.8, marginBottom: 14 }}>{trigger.description}</p>
          <TriggerChecklist trigger={trigger} />
          <p style={{ fontSize: 11, color: "var(--gray)", marginTop: 14, lineHeight: 1.7 }}>
            すべて満たしたら成立として記録します（「開催した」ではなく条件を満たした時点が成立）。記録時には成立日と
            <b>成立の証拠</b>（相手から出た次のアクション提案などの質的メモ）が必須です。
          </p>
        </div>
      </div>
    </div>
  );
}
