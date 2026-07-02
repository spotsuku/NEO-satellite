"use client";

import { useState } from "react";

export default function NameModal({
  current,
  onSave,
  onClose,
  dismissable,
}: {
  current: string;
  onSave: (name: string) => void;
  onClose: () => void;
  dismissable: boolean;
}) {
  const [value, setValue] = useState(current);
  return (
    <div className="modal-bg" onClick={() => dismissable && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="mhd">
          <div>
            <div className="mk">WHO ARE YOU</div>
            <h3>記録者を選択</h3>
          </div>
          {dismissable && (
            <button className="x" onClick={onClose} aria-label="閉じる">
              ×
            </button>
          )}
        </div>
        <div className="mbd">
          <p style={{ fontSize: 12, color: "var(--gray)", lineHeight: 1.7 }}>
            ログインの代わりに、あなたの名前をこのブラウザに保存します。すべての更新に記録者として付与されます。
          </p>
          <label>お名前</label>
          <input
            type="text"
            value={value}
            autoFocus
            placeholder="例: 三木"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && value.trim()) onSave(value.trim());
            }}
          />
          <div className="mfoot">
            <button className="save" disabled={!value.trim()} onClick={() => onSave(value.trim())}>
              この名前で記録する
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
