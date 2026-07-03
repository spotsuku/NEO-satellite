"use client";

// 成立条件チェックリスト。「何をクリアすればいいか」を短い項目で示す。
// base を渡すと T3（準備室5ロール）と T7（加盟金）は実データから自動でチェック状態を計算する。

import type { Trigger, BaseView } from "@/lib/types";
import { YEN } from "@/lib/domain";

export interface CheckItem {
  label: string;
  done: boolean | null; // null = 手動確認項目（自動判定なし）
}

export function buildChecklist(trigger: Trigger, base?: BaseView | null): CheckItem[] {
  if (base && trigger.code === "T3" && base.prep.length > 0) {
    return base.prep.map((p) => ({
      label: `${p.roleName}を確保${p.stakeholderName && p.stakeholderName !== "—" ? `（${p.stakeholderName}）` : ""}`,
      done: p.state === "確保",
    }));
  }
  if (base && trigger.code === "T7") {
    const items: CheckItem[] = [
      {
        label: `確定合計 ${YEN(base.money.fixed)} / ${YEN(base.goalAmount)}万円`,
        done: base.money.fixed >= base.goalAmount,
      },
    ];
    if (base.daysLeft !== null) {
      items.push({
        label:
          base.daysLeft >= 0
            ? `期限内（${base.deadlineLabel} まで・残り${base.daysLeft}日）`
            : `期限超過 ${-base.daysLeft}日（${base.deadlineLabel} まで）`,
        done: base.daysLeft >= 0,
      });
    } else {
      items.push({ label: "T1成立から90日以内にクリアする（T1未成立・時計未始動）", done: null });
    }
    return items;
  }
  return trigger.checklist.map((label) => ({ label, done: null }));
}

export default function TriggerChecklist({
  trigger,
  base,
  dark,
  checked,
  onToggle,
}: {
  trigger: Trigger;
  base?: BaseView | null;
  dark?: boolean; // 黒地（NEXT TRIGGER カード内）用の配色
  checked?: boolean[]; // 手動チェック（記録モーダル用・保存はしない）
  onToggle?: (i: number) => void;
}) {
  const items = buildChecklist(trigger, base);
  const doneCount = items.filter((x, i) => (x.done === null ? checked?.[i] : x.done)).length;
  const sub = dark ? "var(--lgray)" : "var(--gray)";
  const ink = dark ? "#fff" : "var(--ink)";

  return (
    <div style={{ fontSize: 12, lineHeight: 1.7 }}>
      <div style={{ fontSize: 10, letterSpacing: ".18em", color: dark ? "var(--yellow)" : "var(--gray)", fontWeight: 700, marginBottom: 4 }}>
        成立条件チェック（{doneCount}/{items.length}）
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {items.map((it, i) => {
          const isDone = it.done === null ? Boolean(checked?.[i]) : it.done;
          const clickable = it.done === null && onToggle;
          return (
            <li
              key={i}
              onClick={clickable ? () => onToggle(i) : undefined}
              style={{
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                padding: "3px 0",
                cursor: clickable ? "pointer" : "default",
                color: isDone ? ink : sub,
              }}
              title={clickable ? "クリックでチェック（記録の目安・保存はされません）" : undefined}
            >
              <span
                style={{
                  flex: "none",
                  width: 15,
                  height: 15,
                  marginTop: 3,
                  borderRadius: "50%",
                  border: `2px solid ${isDone ? "var(--green)" : dark ? "#555" : "var(--lgray)"}`,
                  background: isDone ? "var(--green)" : "transparent",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 9,
                  fontWeight: 800,
                  color: "var(--ink)",
                }}
              >
                {isDone ? "✓" : ""}
              </span>
              <span style={isDone && it.done !== null ? { fontWeight: 700 } : undefined}>{it.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
