"use client";

import { useState } from "react";
import { recordTriggerEvent } from "@/app/actions";

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
  triggerCode,
  triggerName,
  defaultDate,
  recordedBy,
  onCancel,
  onRecorded,
}: {
  baseCode: string;
  baseName: string;
  triggerCode: string;
  triggerName: string;
  defaultDate: string;
  recordedBy: string;
  onCancel: () => void;
  onRecorded: (p: RecordPayload) => void;
}) {
  const [achievedOn, setAchievedOn] = useState(defaultDate);
  const [participants, setParticipants] = useState("");
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!evidence.trim()) {
      setError("成立の証拠は必須です（相手から出た次のアクション提案など質的メモ）");
      return;
    }
    setBusy(true);
    const payload: RecordPayload = { baseCode, triggerCode, achievedOn, participants, evidence, recordedBy };
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
            <h3>
              {baseName} — {triggerCode} {triggerName}
            </h3>
          </div>
          <button className="x" onClick={onCancel} aria-label="閉じる">
            ×
          </button>
        </div>
        <div className="mbd">
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

          <div className="mfoot">
            <button className="save" onClick={submit} disabled={busy}>
              {busy ? "保存中…" : "成立を記録して祝う"}
            </button>
            <button className="cancel" onClick={onCancel}>
              キャンセル
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
