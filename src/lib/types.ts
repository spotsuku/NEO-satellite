// =============================================================================
// ドメイン型 / ビューモデル
// Supabase モードとモックモードの双方が、この共通の DashboardData を返す。
// UI は計算しない（集計はデータ層／ビューに寄せる）。
// すべて JSON シリアライズ可能（Server → Client 受け渡しのため Date は使わない）。
// =============================================================================

export type StatusName =
  | "未アプローチ"
  | "アポ調整中"
  | "商談中"
  | "検討中"
  | "内諾"
  | "確定"
  | "見送り";

export interface Trigger {
  code: string; // 'T1'
  name: string; // '地域の紹介役合意'
  short: string; // 凡例帯の短縮名（モック互換）
  description: string;
  criteria: string; // 成立条件（何が観測できたら成立と記録するか）
  checklist: string[]; // 成立条件チェックリスト（短い達成項目）
  isClockStart: boolean;
  autoRule: "prep_complete" | "goal_reached" | null;
  sort: number;
}

export interface StatusDef {
  name: StatusName;
  confidence: number;
  isActiveDeal: boolean;
  isTerminal: boolean;
  color: string;
}

export type FuelMetric = "interest" | "loi" | "students" | "partner_univ";

export interface Fuels {
  interest: number;
  loi: number;
  students: number;
  partner_univ: number;
}

export interface MoneyPipeline {
  fixed: number; // 確定合計（万円）
  withSoft: number; // 確定 + 内諾
  weighted: number; // 確定 + Σ(進行中 × 確度)
}

export type PrepState = "未" | "検討中" | "確保";

export interface PrepRole {
  roleName: string;
  state: PrepState;
  stakeholderName: string | null;
}

export interface TriggerLogEntry {
  date: string; // 'MM.DD' 表示用
  isoDate: string; // 'YYYY-MM-DD'
  title: string; // 'T2 現地立上げ戦略会議 成立'
  evidence: string;
  isTrigger: boolean;
}

export interface NextTrigger {
  code: string;
  name: string;
  note?: string;
  ready?: string;
}

export interface Stakeholder {
  id: string;
  baseName: string;
  baseCode: string;
  category: string;
  usesAmount: boolean;
  name: string; // 所属（企業名/機関名。個人のみの場合は氏名）
  contactName: string; // 氏名（担当者）
  title: string; // 役職
  status: StatusName;
  commitAmount: number | null;
  approachedOn: string | null; // ISO
  lastTouchedOn: string | null;
  nextAction: string;
  nextActionDue: string | null;
  isSample: boolean;
  isStale: boolean;
}

export interface BaseView {
  id: string;
  code: string;
  name: string;
  nameEn: string;
  goalAmount: number;
  deadlineDays: number;
  accentColor: string | null;
  silhouettePath: string | null;
  done: number; // 成立トリガー数
  triggersTotal: number;
  achievedCodes: string[]; // 成立済みトリガー code の配列
  clockStartIso: string | null; // T1 成立日
  daysLeft: number | null; // T7 期限まで（マイナス=超過）
  deadlineLabel: string | null; // 'M/D'
  clockPct: number; // 経過率 0-100
  fuels: Fuels;
  fuelTargets: Fuels;
  money: MoneyPipeline;
  prep: PrepRole[];
  prepSecured: number;
  prepTotal: number;
  next: NextTrigger;
  history: TriggerLogEntry[];
  staleCount: number;
  proposeT3: boolean; // 準備室5ロール確保 → T3 成立提案
  proposeT7: boolean; // 確定 >= 目標 → T7 成立提案
}

export interface ActivityItem {
  id: string;
  date: string; // 'MM.DD'
  isoDate: string;
  baseName: string | null;
  kind: string;
  title: string;
  body: string | null;
  isBig: boolean;
  actorName: string | null;
}

export interface MapNodeView {
  id: string;
  baseCode: string;
  stakeholderId: string | null;
  kind: "hub" | "stakeholder" | "free";
  label: string | null; // kind<>'stakeholder' 用
  x: number; // 0-1 比率座標
  y: number;
}

export interface MapEdgeView {
  id: string;
  baseCode: string;
  fromNodeId: string;
  toNodeId: string;
  relType: string;
}

export interface CompanyKpi {
  fixed: number;
  withSoft: number;
  eventsDone: number;
  eventsTotal: number;
  goalTotal: number; // 有効拠点数 × goal_amount
}

export interface DashboardData {
  usingSupabase: boolean;
  today: string; // 'YYYY-MM-DD'（サーバ基準日）
  triggers: Trigger[];
  statuses: StatusDef[];
  categories: { name: string; usesAmount: boolean }[];
  relTypes: { name: string; color: string }[];
  bases: BaseView[];
  company: CompanyKpi;
  stakeholders: Stakeholder[];
  activities: ActivityItem[];
  mapNodes: MapNodeView[]; // Supabase モードのみ（モックはクライアント側でシード）
  mapEdges: MapEdgeView[];
  // 成立条件チェックリストの進捗（手動項目のみ。自動項目は都度計算）
  checklistProgress: { baseCode: string; triggerCode: string; itemIndex: number; checked: boolean }[];
  // トリガーごとの状況メモ＋記録下書き（拠点×トリガーで1件）
  triggerNotes: TriggerNote[];
}

export interface TriggerNote {
  baseCode: string;
  triggerCode: string;
  note: string;
  draftAchievedOn: string | null;
  draftParticipants: string;
  draftEvidence: string;
  updatedBy: string | null;
}
