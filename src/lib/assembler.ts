// =============================================================================
// 正規化済みの生データ（マスタ＋トランザクション）から DashboardData を組み立てる。
// モックモード（mockData.ts）と Supabase モード（data.ts）の共通経路。
// =============================================================================

import type {
  DashboardData,
  Trigger,
  StatusDef,
  BaseView,
  Stakeholder,
  ActivityItem,
  PrepRole,
  TriggerLogEntry,
  StatusName,
  PrepState,
} from "./types";
import {
  computeClock,
  moneyFromStakeholders,
  isStale,
  mmdd,
  TRIGGER_SHORT,
  TRIGGER_CRITERIA,
  TRIGGER_CHECKLIST,
  DEFAULT_FUEL_TARGETS,
} from "./domain";
import { PREFECTURE_PATHS } from "./prefectures";

// DB の silhouette_path の妥当性チェック。
// コピー時の欠落・プレースホルダ混入（「…（略）…」等）で壊れたパスは捨て、
// 組み込みの県パス（PREFECTURE_PATHS）へフォールバックする。
function validSilhouette(p: string | null | undefined): string | null {
  if (!p) return null;
  const t = p.trim();
  if (t.length < 200) return null; // 実パスは数千文字。短すぎるものは破損とみなす
  if (!/^[MLZmlz0-9 .,\-]+$/.test(t)) return null; // SVGパス以外の文字（日本語等）が混入
  return t;
}

export interface RawBase {
  id: string;
  code: string;
  name: string;
  name_en: string;
  region: string | null;
  goal_amount: number;
  deadline_days: number;
  accent_color: string | null;
  silhouette_path: string | null;
  sort: number;
}
export interface RawTrigger {
  code: string;
  name: string;
  description: string | null;
  criteria?: string | null;
  checklist?: string[] | null;
  is_clock_start: boolean;
  auto_rule: "prep_complete" | "goal_reached" | null;
  sort: number;
}
export interface RawStatus {
  name: StatusName;
  confidence: number;
  is_active_deal: boolean;
  is_terminal: boolean;
  color: string;
}
export interface RawCategory {
  name: string;
  uses_amount: boolean;
}
export interface RawStakeholder {
  id: string;
  base_code: string;
  category: string;
  status: StatusName;
  name: string;
  contact_name: string;
  title?: string | null; // 役職
  commit_amount: number | null;
  approached_on: string | null;
  last_touched_on: string | null;
  next_action: string;
  next_action_due: string | null;
  is_sample: boolean;
}
export interface RawTriggerEvent {
  base_code: string;
  trigger_code: string;
  achieved_on: string;
  participants: string | null;
  evidence: string;
  recorded_by: string;
}
export interface RawPrep {
  base_code: string;
  role_name: string;
  sort: number;
  state: PrepState;
  stakeholder_name: string | null;
}
export interface RawFuel {
  base_code: string;
  metric: "interest" | "loi" | "students" | "partner_univ";
  value: number;
}
export interface RawActivity {
  id: string;
  base_name: string | null;
  kind: string;
  title: string;
  body: string | null;
  is_big: boolean;
  actor_name: string | null;
  created_at: string; // ISO datetime or date
}
// NEXT TRIGGER カードの編集メモ（任意・モックのみ）
export interface RawEditorial {
  base_code: string;
  note: string;
  ready: string;
}

export interface RawMapNode {
  id: string;
  base_code: string;
  stakeholder_id: string | null;
  kind: "hub" | "stakeholder" | "free";
  label: string | null;
  x: number;
  y: number;
}
export interface RawMapEdge {
  id: string;
  base_code: string;
  from_node: string;
  to_node: string;
  rel_type: string;
}

export interface RawBundle {
  bases: RawBase[];
  triggers: RawTrigger[];
  statuses: RawStatus[];
  categories: RawCategory[];
  relTypes: { name: string; color: string }[];
  stakeholders: RawStakeholder[];
  triggerEvents: RawTriggerEvent[];
  prep: RawPrep[];
  fuels: RawFuel[];
  activities: RawActivity[];
  editorial?: RawEditorial[];
  mapNodes?: RawMapNode[];
  mapEdges?: RawMapEdge[];
  fuelTargetOverrides?: { base_code: string; metric: string; target: number }[];
  settings?: Record<string, number>; // app_settings の燃料目標デフォルト等
}

export function buildDashboard(
  raw: RawBundle,
  todayIso: string,
  usingSupabase: boolean,
): DashboardData {
  const triggers: Trigger[] = [...raw.triggers]
    .sort((a, b) => a.sort - b.sort)
    .map((t) => ({
      code: t.code,
      name: t.name,
      short: TRIGGER_SHORT[t.code] ?? t.name,
      description: t.description ?? "",
      criteria: t.criteria ?? TRIGGER_CRITERIA[t.code] ?? "",
      checklist: t.checklist ?? TRIGGER_CHECKLIST[t.code] ?? [],
      isClockStart: t.is_clock_start,
      autoRule: t.auto_rule,
      sort: t.sort,
    }));

  const statuses: StatusDef[] = raw.statuses.map((s) => ({
    name: s.name,
    confidence: Number(s.confidence),
    isActiveDeal: s.is_active_deal,
    isTerminal: s.is_terminal,
    color: s.color,
  }));

  const catByName = new Map(raw.categories.map((c) => [c.name, c]));
  const clockTriggerCode = triggers.find((t) => t.isClockStart)?.code ?? "T1";
  const triggersTotal = triggers.length;

  // ---- ステークホルダー（全社横断テーブル用）----
  const baseName = new Map(raw.bases.map((b) => [b.code, b.name]));
  const stakeholders: Stakeholder[] = raw.stakeholders.map((s) => {
    const cat = catByName.get(s.category);
    return {
      id: s.id,
      baseName: baseName.get(s.base_code) ?? s.base_code,
      baseCode: s.base_code,
      category: s.category,
      usesAmount: cat?.uses_amount ?? false,
      name: s.name,
      contactName: s.contact_name,
      title: s.title ?? "",
      status: s.status,
      commitAmount: s.commit_amount,
      approachedOn: s.approached_on,
      lastTouchedOn: s.last_touched_on,
      nextAction: s.next_action,
      nextActionDue: s.next_action_due,
      isSample: s.is_sample,
      isStale: isStale(
        {
          status: s.status,
          nextAction: s.next_action,
          approachedOn: s.approached_on,
          lastTouchedOn: s.last_touched_on,
        },
        statuses,
        todayIso,
      ),
    };
  });

  const editorialByBase = new Map((raw.editorial ?? []).map((e) => [e.base_code, e]));

  // ---- 拠点ビュー ----
  const bases: BaseView[] = [...raw.bases]
    .sort((a, b) => a.sort - b.sort)
    .map((b) => {
      const events = raw.triggerEvents
        .filter((e) => e.base_code === b.code)
        .sort((x, y) => (x.achieved_on < y.achieved_on ? 1 : -1));
      const achievedCodes = events.map((e) => e.trigger_code);
      const done = achievedCodes.length;

      const clockStartIso =
        events.find((e) => e.trigger_code === clockTriggerCode)?.achieved_on ?? null;
      const clock = computeClock(clockStartIso, b.deadline_days, todayIso);

      // 燃料（最新値）
      const fuelFor = (m: RawFuel["metric"]) =>
        raw.fuels.find((f) => f.base_code === b.code && f.metric === m)?.value ?? 0;
      const fuels = {
        interest: fuelFor("interest"),
        loi: fuelFor("loi"),
        students: fuelFor("students"),
        partner_univ: fuelFor("partner_univ"),
      };

      // 加盟金
      const money = moneyFromStakeholders(
        stakeholders
          .filter((s) => s.baseCode === b.code)
          .map((s) => ({ commitAmount: s.commitAmount, status: s.status, usesAmount: s.usesAmount })),
        statuses,
      );

      // 準備室ロール
      const prepRows = raw.prep
        .filter((p) => p.base_code === b.code)
        .sort((x, y) => x.sort - y.sort);
      const prep: PrepRole[] = prepRows.map((p) => ({
        roleName: p.role_name,
        state: p.state,
        stakeholderName: p.stakeholder_name,
      }));
      const prepTotal = prepRows.length || 5;
      const prepSecured = prep.filter((p) => p.state === "確保").length;

      // NEXT = 最初の未成立トリガー（飛び石で成立した場合も正しく指す）
      const nextT =
        triggers.find((t) => !achievedCodes.includes(t.code)) ?? triggers[triggersTotal - 1];
      const ed = editorialByBase.get(b.code);
      const next = {
        code: nextT.code,
        name: nextT.name,
        note: ed?.note,
        ready: ed?.ready,
      };

      // トリガーログ
      const history: TriggerLogEntry[] = events.map((e) => {
        const t = triggers.find((x) => x.code === e.trigger_code);
        return {
          date: mmdd(e.achieved_on),
          isoDate: e.achieved_on,
          title: `${e.trigger_code} ${t?.name ?? ""} 成立`,
          evidence: e.evidence,
          isTrigger: true,
        };
      });

      // 燃料目標: 拠点別 fuel_targets → app_settings → 既定値
      const targetFor = (m: keyof typeof DEFAULT_FUEL_TARGETS) =>
        raw.fuelTargetOverrides?.find((t) => t.base_code === b.code && t.metric === m)?.target ??
        raw.settings?.[`fuel_target_${m}`] ??
        DEFAULT_FUEL_TARGETS[m];
      const fuelTargets = {
        interest: targetFor("interest"),
        loi: targetFor("loi"),
        students: targetFor("students"),
        partner_univ: targetFor("partner_univ"),
      };

      const staleCount = stakeholders.filter((s) => s.baseCode === b.code && s.isStale).length;

      const proposeT3 = prepSecured === prepTotal && !achievedCodes.includes("T3");
      const proposeT7 = money.fixed >= b.goal_amount && !achievedCodes.includes("T7");

      return {
        id: b.id,
        code: b.code,
        name: b.name,
        nameEn: b.name_en,
        goalAmount: b.goal_amount,
        deadlineDays: b.deadline_days,
        accentColor: b.accent_color,
        silhouettePath: validSilhouette(b.silhouette_path) ?? PREFECTURE_PATHS[b.code] ?? null,
        done,
        triggersTotal,
        achievedCodes,
        clockStartIso,
        daysLeft: clock.daysLeft,
        deadlineLabel: clock.deadlineLabel,
        clockPct: clock.clockPct,
        fuels,
        fuelTargets,
        money,
        prep,
        prepSecured,
        prepTotal,
        next,
        history,
        staleCount,
        proposeT3,
        proposeT7,
      } satisfies BaseView;
    });

  // ---- 全社KPI ----
  const company = {
    fixed: bases.reduce((s, b) => s + b.money.fixed, 0),
    withSoft: bases.reduce((s, b) => s + b.money.withSoft, 0),
    eventsDone: bases.reduce((s, b) => s + b.done, 0),
    eventsTotal: bases.length * triggersTotal,
    goalTotal: bases.reduce((s, b) => s + b.goalAmount, 0),
  };

  // ---- アクティビティ ----
  const activities: ActivityItem[] = [...raw.activities]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .map((a) => ({
      id: a.id,
      date: mmdd(a.created_at.slice(0, 10)),
      isoDate: a.created_at.slice(0, 10),
      baseName: a.base_name,
      kind: a.kind,
      title: a.title,
      body: a.body,
      isBig: a.is_big,
      actorName: a.actor_name,
    }));

  return {
    usingSupabase,
    today: todayIso,
    triggers,
    statuses,
    categories: raw.categories.map((c) => ({ name: c.name, usesAmount: c.uses_amount })),
    relTypes: raw.relTypes,
    bases,
    company,
    stakeholders,
    activities,
    mapNodes: (raw.mapNodes ?? []).map((n) => ({
      id: n.id,
      baseCode: n.base_code,
      stakeholderId: n.stakeholder_id,
      kind: n.kind,
      label: n.label,
      x: Number(n.x),
      y: Number(n.y),
    })),
    mapEdges: (raw.mapEdges ?? []).map((e) => ({
      id: e.id,
      baseCode: e.base_code,
      fromNodeId: e.from_node,
      toNodeId: e.to_node,
      relType: e.rel_type,
    })),
  };
}
