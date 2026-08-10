"use client";

// 成立条件チェックリスト。「何をクリアすればいいか」を短い項目で示す。
// base を渡すと準備室5ロール・加盟金のトリガー（auto_rule で判定）は実データから自動でチェック状態を計算する。
// 準備室ロールの項目は actorName 付きで描画するとクリックで「合意⇄未」を直接切り替えられる。

import { useState } from "react";
import type { Trigger, BaseView, PrepState } from "@/lib/types";
import { YEN } from "@/lib/domain";
import { updatePrepAssignment } from "@/app/actions";

export interface CheckItem {
  label: string;
  done: boolean | null; // null = 手動確認項目（自動判定なし）
  meta?: boolean; // 期限など「作業の前進」を意味しない付帯項目（進行中判定から除外）
  prepRole?: string; // 準備室ロール連動の項目（クリックでロール状態を切り替え）
}

export function buildChecklist(trigger: Trigger, base?: BaseView | null): CheckItem[] {
  if (base && trigger.autoRule === "prep_complete" && base.prep.length > 0) {
    return base.prep.map((p) => ({
      label: `${p.roleName}と合意${p.stakeholderName && p.stakeholderName !== "—" ? `（${p.stakeholderName}）` : ""}`,
      done: p.state === "合意",
      prepRole: p.roleName,
    }));
  }
  if (base && trigger.autoRule === "goal_reached") {
    // T6と同じ「1社目/2社目/3社目」の手動チェック（保存・全員共有）を先頭に、
    // 自動判定（確定合計・期限）をその下に表示する。
    const items: CheckItem[] = trigger.checklist.map((label) => ({ label, done: null }));
    items.push({
      label: `確定合計 ${YEN(base.money.fixed)} / ${YEN(base.goalAmount)}万円`,
      done: base.money.fixed >= base.goalAmount,
    });
    if (base.daysLeft !== null) {
      items.push({
        label:
          base.daysLeft >= 0
            ? `期限内（${base.deadlineLabel} まで・残り${base.daysLeft}日）`
            : `期限超過 ${-base.daysLeft}日（${base.deadlineLabel} まで）`,
        done: base.daysLeft >= 0,
        meta: true,
      });
    } else {
      items.push({ label: "T1成立から90日以内にクリアする（T1未成立・時計未始動）", done: null, meta: true });
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
  actorName,
}: {
  trigger: Trigger;
  base?: BaseView | null;
  dark?: boolean; // 黒地（NEXT TRIGGER カード内）用の配色
  checked?: boolean[]; // 手動チェック（記録モーダル用・保存はしない）
  onToggle?: (i: number) => void;
  actorName?: string; // 指定すると準備室ロール項目をクリックで合意⇄未に切り替えられる
}) {
  // 準備室ロールの楽観的上書き（クリック直後に反映。サーバー反映後は本データが揃う）
  const [prepOv, setPrepOv] = useState<Record<string, PrepState>>({});
  const effBase =
    base && Object.keys(prepOv).length
      ? { ...base, prep: base.prep.map((p) => (prepOv[p.roleName] ? { ...p, state: prepOv[p.roleName] } : p)) }
      : base;
  const items = buildChecklist(trigger, effBase);
  const doneCount = items.filter((x, i) => (x.done === null ? checked?.[i] : x.done)).length;
  const sub = dark ? "var(--lgray)" : "var(--gray)";
  const ink = dark ? "#fff" : "var(--ink)";

  function togglePrep(roleName: string, isDone: boolean) {
    if (!base || !actorName) return;
    const next: PrepState = isDone ? "未" : "合意";
    setPrepOv((o) => ({ ...o, [roleName]: next }));
    void updatePrepAssignment({ baseCode: base.code, roleName, state: next, actorName });
  }

  return (
    <div style={{ fontSize: 12, lineHeight: 1.7 }}>
      <div style={{ fontSize: 10, letterSpacing: ".18em", color: dark ? "var(--yellow)" : "var(--gray)", fontWeight: 700, marginBottom: 4 }}>
        成立条件チェック（{doneCount}/{items.length}）
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {items.map((it, i) => {
          const isDone = it.done === null ? Boolean(checked?.[i]) : it.done;
          const prepClickable = Boolean(it.prepRole && base && actorName);
          const clickable = (it.done === null && onToggle) || prepClickable;
          return (
            <li
              key={i}
              onClick={
                prepClickable
                  ? () => togglePrep(it.prepRole!, Boolean(isDone))
                  : it.done === null && onToggle
                    ? () => onToggle(i)
                    : undefined
              }
              style={{
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                padding: "3px 0",
                cursor: clickable ? "pointer" : "default",
                color: isDone ? ink : sub,
              }}
              title={
                prepClickable
                  ? "クリックで準備室ロールと合意⇄未に切り替え（保存され全員に共有）"
                  : clickable
                    ? "クリックでチェック（保存され全員に共有）"
                    : undefined
              }
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
