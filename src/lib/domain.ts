// =============================================================================
// ドメイン計算ヘルパー（純粋関数）。モック／Supabase 双方の集計で共用。
// =============================================================================

import type { StatusDef, MoneyPipeline, Fuels } from "./types";

export const YEN = (n: number) => n.toLocaleString("ja-JP");

export const DEFAULT_FUEL_TARGETS: Fuels = {
  interest: 10,
  loi: 20,
  students: 100,
  partner_univ: 8,
};

// 成立条件のフォールバック（triggers.criteria 未設定の DB / モックモード用）
export const TRIGGER_CRITERIA: Record<string, string> = {
  T1: "地域の顔役が「事務局目線」での紹介協力に合意し、具体的な紹介先の名前が相手側から出ている。成立日が90日時計の起点になる。",
  T2: "戦略会議（飲み会）の場で、参加者側から次のアクション提案や宿題の持ち帰りが出る＝「俺たちのプロジェクト」化のサインが観測できる。",
  T3: "準備室5ロール（現地紹介者・オーナー企業候補・学生リーダー候補・大学高校関係者・自治体関係者）がすべて「確保」になっている。充足すると成立提案バナーが出るが、確定は人の記録操作。",
  T4: "現地説明会を開催し、参加者から個別相談・追加の紹介・参画意向など次につながる反応が出ている。",
  T5: "オーナー候補の経営トップとの会談で、出資検討の意思（金額感・社内検討の約束など）が表明される。",
  T6: "1社目のオーナー企業との加盟契約の調印が完了している。",
  T7: "ステータス「確定」の加盟金合計が拠点目標（既定3,000万円）に到達している。T1成立から90日以内が期限。到達すると成立提案バナーが出る。",
  T8: "キックオフ（開校）イベントを実施し、拠点の本番運営が始まっている。",
};

// 成立条件チェックリストのフォールバック（DB未設定時）
export const TRIGGER_CHECKLIST: Record<string, string[]> = {
  T1: [
    "地域の顔役（キーマン）とつながる",
    "「事務局目線」での紹介協力に合意してもらう",
    "相手から具体的な紹介先の名前が出る",
  ],
  T2: [
    "顔役の紹介で関係者を集めて戦略会議（飲み会）を開く",
    "参加者側から次のアクション提案が出る",
    "宿題の持ち帰りが出る（自分ごと化のサイン）",
  ],
  T3: [
    "現地紹介者を確保",
    "オーナー企業候補を確保",
    "学生リーダー候補を確保",
    "大学・高校関係者を確保",
    "自治体関係者を確保",
  ],
  T4: ["現地説明会を開催する", "参加者から個別相談・追加の紹介・参画意向が出る"],
  T5: [
    "オーナー候補の経営トップとの会談を設定する",
    "トップから出資検討の意思が表明される（金額感・社内検討の約束）",
  ],
  T6: ["1社目のオーナー企業と加盟条件に合意する", "調印式を実施する"],
  T7: ["ステータス「確定」の加盟金合計が拠点目標に到達する", "T1成立から90日以内にクリアする"],
  T8: ["キックオフ（開校）イベントを実施する", "拠点の本番運営が始まる"],
};

// 'T1'→'紹介役合意' のような凡例帯短縮名（モック互換）
export const TRIGGER_SHORT: Record<string, string> = {
  T1: "紹介役合意",
  T2: "戦略会議",
  T3: "準備室発足",
  T4: "説明会",
  T5: "トップ会談",
  T6: "調印式",
  T7: "3000万達成",
  T8: "キックオフ",
};

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(fromIso + "T00:00:00Z");
  const b = Date.parse(toIso + "T00:00:00Z");
  return Math.round((b - a) / 86400000);
}

export function addDays(iso: string, days: number): string {
  const t = Date.parse(iso + "T00:00:00Z") + days * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

export function mmdd(iso: string): string {
  // 'YYYY-MM-DD' → 'MM.DD'
  const [, m, d] = iso.split("-");
  return `${m}.${d}`;
}

export function slashMD(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

// 90日時計: clockStart（T1成立日）から deadlineDays 後が T7 期限
export function computeClock(
  clockStartIso: string | null,
  deadlineDays: number,
  todayIso: string,
): { daysLeft: number | null; deadlineLabel: string | null; clockPct: number } {
  if (!clockStartIso) return { daysLeft: null, deadlineLabel: null, clockPct: 0 };
  const dueIso = addDays(clockStartIso, deadlineDays);
  const daysLeft = daysBetween(todayIso, dueIso);
  const elapsed = daysBetween(clockStartIso, todayIso);
  const clockPct = Math.min(100, Math.max(0, (elapsed / deadlineDays) * 100));
  return { daysLeft, deadlineLabel: slashMD(dueIso), clockPct };
}

// 加盟金パイプライン3層（確定 / 確定+内諾 / 確定+Σ進行中×確度）
// v_money_pipeline と同じ計算を TS 側でも用意（モックモード用）。
export function moneyFromStakeholders(
  rows: { commitAmount: number | null; status: string; usesAmount: boolean }[],
  statuses: StatusDef[],
): MoneyPipeline {
  const byName = new Map<string, StatusDef>(statuses.map((s) => [s.name, s]));
  let fixed = 0,
    withSoft = 0,
    weighted = 0;
  for (const r of rows) {
    if (!r.usesAmount) continue;
    const amt = r.commitAmount ?? 0;
    const st = byName.get(r.status);
    if (!st) continue;
    if (st.name === "確定") {
      fixed += amt;
      withSoft += amt;
      weighted += amt;
    } else if (st.name === "内諾") {
      withSoft += amt;
      weighted += amt * st.confidence;
    } else if (st.isActiveDeal) {
      weighted += amt * st.confidence;
    }
  }
  return { fixed, withSoft, weighted: Math.round(weighted) };
}

// 停滞判定: 進行中ステータス かつ（次回アクション未設定 or 最終更新から14日超）
export function isStale(
  s: {
    status: string;
    nextAction: string;
    approachedOn: string | null;
    lastTouchedOn: string | null;
  },
  statuses: StatusDef[],
  todayIso: string,
): boolean {
  const st = statuses.find((x) => x.name === s.status);
  if (!st || !st.isActiveDeal) return false;
  if (!s.nextAction || s.nextAction.trim() === "") return true;
  const ref = s.lastTouchedOn || s.approachedOn;
  if (ref && daysBetween(ref, todayIso) > 14) return true;
  return false;
}

export function pct(value: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, (value / target) * 100);
}
