"use client";

import { useState } from "react";
import { recordTriggerEvent } from "@/app/actions";
import type { Trigger, BaseView } from "@/lib/types";
import TriggerChecklist from "./TriggerChecklist";

export interface RecordPayload {
  baseCode: string;
  triggerCode: string;
  achievedOn: string;
  participants: string;
  evidence: string;
  recordedBy: string;
}

export default function TriggerRecordModal({
  baseCode,
  baseName,
  base,
  triggers,
  achievedCodes,
  initialCode,
  defaultDate,
  recordedBy,
  usingSupabase,
  checklistChecked,
  onChecklistToggle,
  onCancel,
  onRecorded,
  onUnrecord,
}: {
  baseCode: string;
  baseName: string;
  base?: BaseView | null;
  triggers: Trigger[];
  achievedCodes: string[];
  initialCode: string;
  defaultDate: string;
  recordedBy: string;
  usingSupabase: boolean;
  checklistChecked: (triggerCode: string) => boolean[];
  onChecklistToggle: (triggerCode: string, itemIndex: number) => void;
  onCancel: () => void;
  onRecorded: (p: RecordPayload) => void;
  onUnrecord: (triggerCode: string) => void;
}) {
  const [code, setCode] = useState(
    triggers.some((t) => t.code === initialCode) ? initialCode : (triggers[0]?.code ?? initialCode),
  );
  const [achievedOn, setAchievedOn] = useState(defaultDate);
  const [participants, setParticipants] = useState("");
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = triggers.find((t) => t.code === code);
  const isAchieved = achievedCodes.includes(code);
  const achievedLog = base?.history.find((h) => h.title.startsWith(`${code} `));

  async function submit() {
    setError(null);
    if (!evidence.trim()) {
      setError("成立の証拠は必須です（相手から出た次のアクション提案など質的メモ）");
      return;
    }
    setBusy(true);
    const payload: RecordPayload = {
      baseCode,
      triggerCode: code,
      achievedOn,
      participants,
      evidence,
      recordedBy,
    };
    const res = await recordTriggerEvent(payload);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "保存に失敗しました");
      return;
    }
    onRecorded(payload);
  }

  return (
    <div className="modal-bg" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mhd">
          <div>
            <div className="mk">RECORD TRIGGER</div>
            <h3>{baseName} — イベント成立を記録</h3>
          </div>
          <button className="x" onClick={onCancel} aria-label="閉じる">
            ×
          </button>
        </div>
        <div className="mbd">
          <label>
            トリガー<span className="req">*</span>
          </label>
          <select value={code} onChange={(e) => setCode(e.target.value)}>
            {triggers.map((t) => (
              <option key={t.code} value={t.code}>
                {t.code} {t.name}
                {achievedCodes.includes(t.code) ? "（成立済み）" : ""}
              </option>
            ))}
          </select>

          {selected && (
            <div
              style={{
                border: "1px solid var(--line)",
                borderLeft: "3px solid var(--ink)",
                padding: "10px 12px",
                margin: "10px 0 2px",
              }}
            >
              <TriggerChecklist
                trigger={selected}
                base={base}
                checked={checklistChecked(selected.code)}
                onToggle={(i) => onChecklistToggle(selected.code, i)}
              />
              <p style={{ fontSize: 10, color: "var(--gray)", marginTop: 4 }}>
                チェックは保存され、全員に共有されます（段階的に埋めていけます）
              </p>
            </div>
          )}

          {isAchieved ? (
            <>
              {/* 成立済みトリガー: ここから直接取り消して未成立に戻せる */}
              <div
                style={{
                  border: "1px solid var(--line)",
                  borderLeft: "3px solid var(--green)",
                  padding: "10px 12px",
                  margin: "14px 0 4px",
                  fontSize: 12,
                  lineHeight: 1.7,
                }}
              >
                <b>このトリガーは成立済みです</b>
                {achievedLog && (
                  <>
                    <br />
                    成立日 {achievedLog.date} ／ {achievedLog.evidence}
                  </>
                )}
              </div>
              <p style={{ fontSize: 11, color: "var(--gray)", marginTop: 8, lineHeight: 1.7 }}>
                取り消すと未成立に戻り、進捗・NEXT・90日時計も巻き戻ります（取り消しはアクティビティに記録されます）。
              </p>
              {!usingSupabase && (
                <p style={{ fontSize: 10.5, color: "var(--red)", marginTop: 8 }}>
                  ⚠ モックモード（Supabase未設定）: 変更は画面上のみで、再読み込みで元に戻ります。
                </p>
              )}
              <div className="mfoot">
                <button
                  className="save"
                  style={{ background: "var(--red)" }}
                  onClick={() => {
                    if (window.confirm(`${code} ${selected?.name ?? ""} の成立を取り消して未成立に戻しますか？`)) {
                      onUnrecord(code);
                    }
                  }}
                >
                  成立を取り消して未成立に戻す
                </button>
                <button className="cancel" onClick={onCancel}>
                  閉じる
                </button>
              </div>
            </>
          ) : (
            <>
              <label>
                成立日<span className="req">*</span>
              </label>
              <input type="date" value={achievedOn} onChange={(e) => setAchievedOn(e.target.value)} />

              <label>参加者（自由記述）</label>
              <input
                type="text"
                value={participants}
                placeholder="例: 参加9名（◯◯氏・△△社長 ほか）"
                onChange={(e) => setParticipants(e.target.value)}
              />

              <label>
                成立の証拠<span className="req">*</span>
              </label>
              <textarea
                value={evidence}
                placeholder="「相手から出た次のアクション提案」など、成立条件を満たした質的な根拠を記録"
                onChange={(e) => setEvidence(e.target.value)}
              />

              <label>記録者</label>
              <input type="text" value={recordedBy} readOnly style={{ color: "var(--gray)" }} />

              {error && <div className="err">{error}</div>}
              {!usingSupabase && (
                <p style={{ fontSize: 10.5, color: "var(--red)", marginTop: 10 }}>
                  ⚠ モックモード（Supabase未設定）: 記録は画面上のみで、再読み込みで消えます。
                </p>
              )}

              <div className="mfoot">
                <button className="save" onClick={submit} disabled={busy}>
                  {busy ? "保存中…" : "成立を記録して祝う"}
                </button>
                <button className="cancel" onClick={onCancel}>
                  キャンセル
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
