// =============================================================================
// モックデータ（Supabase 未設定時のフォールバック）
// design モックの DATA を正規化した RawBundle。
// Excel 受け入れ相当データ（大分: ジェイリース＝オーナー候補/商談中/1000万、APU＝教育機関）を含む。
// =============================================================================

import type { RawBundle } from "./assembler";

export const MOCK_BUNDLE: RawBundle = {
  bases: [
    { id: "oita", code: "oita", name: "大分", name_en: "OITA", region: "九州", goal_amount: 3000, deadline_days: 90, accent_color: "#00C0F0", silhouette_path: null, sort: 1 },
    { id: "kumamoto", code: "kumamoto", name: "熊本", name_en: "KUMAMOTO", region: "九州", goal_amount: 3000, deadline_days: 90, accent_color: "#F03090", silhouette_path: null, sort: 2 },
    { id: "nagasaki", code: "nagasaki", name: "長崎", name_en: "NAGASAKI", region: "九州", goal_amount: 3000, deadline_days: 90, accent_color: "#F0F000", silhouette_path: null, sort: 3 },
    { id: "saga", code: "saga", name: "佐賀", name_en: "SAGA", region: "九州", goal_amount: 3000, deadline_days: 90, accent_color: "#50F000", silhouette_path: null, sort: 4 },
  ],
  triggers: [
    { code: "T1", name: "地域の紹介役合意", description: "顔役が事務局目線で紹介協力を合意", is_clock_start: true, auto_rule: null, sort: 1 },
    { code: "T2", name: "現地立上げ戦略会議", description: "関係者が自分ごと化する（飲み会）", is_clock_start: false, auto_rule: null, sort: 2 },
    { code: "T3", name: "準備室発足", description: "5ロール各1名以上で完成", is_clock_start: false, auto_rule: "prep_complete", sort: 3 },
    { code: "T4", name: "現地説明会", description: "地域に構想をお披露目", is_clock_start: false, auto_rule: null, sort: 4 },
    { code: "T5", name: "オーナー候補トップ会談", description: "経営者が出資検討者になる", is_clock_start: false, auto_rule: null, sort: 5 },
    { code: "T6", name: "1社目調印式", description: "構想が実在に変わる", is_clock_start: false, auto_rule: null, sort: 6 },
    { code: "T7", name: "加盟金3000万円達成", description: "立上げ条件クリア（T1から3ヶ月）", is_clock_start: false, auto_rule: "goal_reached", sort: 7 },
    { code: "T8", name: "キックオフ（開校）", description: "本番の舞台が始まる", is_clock_start: false, auto_rule: null, sort: 8 },
  ],
  statuses: [
    { name: "未アプローチ", confidence: 0, is_active_deal: false, is_terminal: false, color: "#707070" },
    { name: "アポ調整中", confidence: 0, is_active_deal: true, is_terminal: false, color: "#00C0F0" },
    { name: "商談中", confidence: 0.3, is_active_deal: true, is_terminal: false, color: "#00C0F0" },
    { name: "検討中", confidence: 0.5, is_active_deal: true, is_terminal: false, color: "#F0F000" },
    { name: "内諾", confidence: 0.8, is_active_deal: true, is_terminal: false, color: "#F03090" },
    { name: "確定", confidence: 1.0, is_active_deal: false, is_terminal: true, color: "#50F000" },
    { name: "見送り", confidence: 0, is_active_deal: false, is_terminal: true, color: "#F01010" },
  ],
  categories: [
    { name: "オーナー候補", uses_amount: true },
    { name: "教育機関", uses_amount: false },
    { name: "自治体・メディア", uses_amount: false },
    { name: "事務局", uses_amount: false },
    { name: "学生事務局", uses_amount: false },
    { name: "紹介役", uses_amount: false },
    { name: "その他", uses_amount: false },
  ],
  relTypes: [
    { name: "紹介", color: "#00C0F0" },
    { name: "協力", color: "#50F000" },
    { name: "出資検討", color: "#F03090" },
    { name: "連携", color: "#0A0A0A" },
  ],
  stakeholders: [
    { id: "sk1", base_code: "oita", category: "オーナー候補", status: "商談中", name: "ジェイリース", contact_name: "—", commit_amount: 1000, approached_on: "2026-06-24", last_touched_on: "2026-06-24", next_action: "役員向け収支シミュレーション提示（7/10）", next_action_due: "2026-07-10", is_sample: false },
    { id: "sk2", base_code: "oita", category: "教育機関", status: "商談中", name: "APU（立命館アジア太平洋大学）", contact_name: "地域連携室", commit_amount: null, approached_on: "2026-06-18", last_touched_on: "2026-06-18", next_action: "連携形式の選択肢を提示", next_action_due: null, is_sample: false },
    { id: "sk3", base_code: "oita", category: "オーナー候補", status: "アポ調整中", name: "県内メーカーA社", contact_name: "経営企画", commit_amount: null, approached_on: "2026-06-26", last_touched_on: "2026-06-26", next_action: "初回訪問の日程調整", next_action_due: null, is_sample: true },
    { id: "sk4", base_code: "oita", category: "自治体・メディア", status: "未アプローチ", name: "大分市 商工労政課", contact_name: "—", commit_amount: null, approached_on: null, last_touched_on: null, next_action: "", next_action_due: null, is_sample: true },
    { id: "sk5", base_code: "oita", category: "学生事務局", status: "検討中", name: "学生リーダー候補 K氏", contact_name: "APU 3年", commit_amount: null, approached_on: "2026-06-21", last_touched_on: "2026-06-21", next_action: "戦略会議の議事メモ共有・役割相談", next_action_due: null, is_sample: true },
    { id: "sk6", base_code: "kumamoto", category: "オーナー候補", status: "アポ調整中", name: "地場IT B社", contact_name: "代表", commit_amount: null, approached_on: "2026-06-27", last_touched_on: "2026-06-27", next_action: "キーマン同席での顔合わせ", next_action_due: null, is_sample: true },
    { id: "sk7", base_code: "kumamoto", category: "教育機関", status: "未アプローチ", name: "熊本大学", contact_name: "—", commit_amount: null, approached_on: null, last_touched_on: null, next_action: "", next_action_due: null, is_sample: true },
    { id: "sk8", base_code: "kumamoto", category: "事務局", status: "検討中", name: "事務局長候補 M氏", contact_name: "元商社・Uターン", commit_amount: null, approached_on: "2026-06-10", last_touched_on: "2026-06-10", next_action: "", next_action_due: null, is_sample: true },
    { id: "sk9", base_code: "nagasaki", category: "オーナー候補", status: "未アプローチ", name: "造船関連 C社", contact_name: "—", commit_amount: null, approached_on: null, last_touched_on: null, next_action: "", next_action_due: null, is_sample: true },
    { id: "sk10", base_code: "nagasaki", category: "自治体・メディア", status: "未アプローチ", name: "長崎新聞社", contact_name: "—", commit_amount: null, approached_on: null, last_touched_on: null, next_action: "", next_action_due: null, is_sample: true },
    { id: "sk11", base_code: "saga", category: "オーナー候補", status: "未アプローチ", name: "（リスト作成中）", contact_name: "—", commit_amount: null, approached_on: null, last_touched_on: null, next_action: "", next_action_due: null, is_sample: true },
  ],
  triggerEvents: [
    { base_code: "oita", trigger_code: "T1", achieved_on: "2026-06-02", participants: "地場金融OB ◯◯氏", evidence: "地場金融OBの◯◯氏が事務局目線での紹介協力を合意。ジェイリース・APUへの橋渡しを快諾。⏱ 3ヶ月時計スタート。", recorded_by: "システム（サンプル）" },
    { base_code: "oita", trigger_code: "T2", achieved_on: "2026-06-20", participants: "参加9名", evidence: "会の途中で◯◯氏から「次は△△社の社長を呼ぼう」の発言。宿題持ち帰り3名。", recorded_by: "システム（サンプル）" },
    { base_code: "kumamoto", trigger_code: "T1", achieved_on: "2026-06-25", participants: "地元企業キーマン", evidence: "半導体関連の進出で地元企業の人材危機感が強い。紹介協力の合意取得。⏱ 3ヶ月時計スタート。", recorded_by: "システム（サンプル）" },
  ],
  prep: [
    // 大分: 3/5 確保・1検討中
    { base_code: "oita", role_name: "現地紹介者", sort: 1, state: "確保", stakeholder_name: "◯◯氏（地場金融OB）" },
    { base_code: "oita", role_name: "オーナー企業候補", sort: 2, state: "確保", stakeholder_name: "ジェイリース" },
    { base_code: "oita", role_name: "学生リーダー候補", sort: 3, state: "検討中", stakeholder_name: "K氏（APU3年・検討中）" },
    { base_code: "oita", role_name: "大学・高校関係者", sort: 4, state: "確保", stakeholder_name: "APU 地域連携室" },
    { base_code: "oita", role_name: "自治体関係者", sort: 5, state: "未", stakeholder_name: "未接触" },
    // 熊本: 1/5
    { base_code: "kumamoto", role_name: "現地紹介者", sort: 1, state: "確保", stakeholder_name: "キーマン◯◯氏" },
    { base_code: "kumamoto", role_name: "オーナー企業候補", sort: 2, state: "検討中", stakeholder_name: "地場IT B社（アポ調整中）" },
    { base_code: "kumamoto", role_name: "学生リーダー候補", sort: 3, state: "未", stakeholder_name: "未接触" },
    { base_code: "kumamoto", role_name: "大学・高校関係者", sort: 4, state: "未", stakeholder_name: "未接触" },
    { base_code: "kumamoto", role_name: "自治体関係者", sort: 5, state: "未", stakeholder_name: "未接触" },
    // 長崎
    { base_code: "nagasaki", role_name: "現地紹介者", sort: 1, state: "未", stakeholder_name: "候補2名と接触中" },
    { base_code: "nagasaki", role_name: "オーナー企業候補", sort: 2, state: "未", stakeholder_name: "—" },
    { base_code: "nagasaki", role_name: "学生リーダー候補", sort: 3, state: "未", stakeholder_name: "—" },
    { base_code: "nagasaki", role_name: "大学・高校関係者", sort: 4, state: "未", stakeholder_name: "—" },
    { base_code: "nagasaki", role_name: "自治体関係者", sort: 5, state: "未", stakeholder_name: "—" },
    // 佐賀
    { base_code: "saga", role_name: "現地紹介者", sort: 1, state: "未", stakeholder_name: "—" },
    { base_code: "saga", role_name: "オーナー企業候補", sort: 2, state: "未", stakeholder_name: "—" },
    { base_code: "saga", role_name: "学生リーダー候補", sort: 3, state: "未", stakeholder_name: "—" },
    { base_code: "saga", role_name: "大学・高校関係者", sort: 4, state: "未", stakeholder_name: "—" },
    { base_code: "saga", role_name: "自治体関係者", sort: 5, state: "未", stakeholder_name: "—" },
  ],
  fuels: [
    { base_code: "oita", metric: "interest", value: 8 },
    { base_code: "oita", metric: "loi", value: 3 },
    { base_code: "oita", metric: "students", value: 12 },
    { base_code: "oita", metric: "partner_univ", value: 1 },
    { base_code: "kumamoto", metric: "interest", value: 4 },
    { base_code: "kumamoto", metric: "loi", value: 1 },
    { base_code: "kumamoto", metric: "students", value: 0 },
    { base_code: "kumamoto", metric: "partner_univ", value: 0 },
    { base_code: "nagasaki", metric: "interest", value: 2 },
    { base_code: "nagasaki", metric: "loi", value: 0 },
    { base_code: "nagasaki", metric: "students", value: 0 },
    { base_code: "nagasaki", metric: "partner_univ", value: 0 },
    { base_code: "saga", metric: "interest", value: 0 },
    { base_code: "saga", metric: "loi", value: 0 },
    { base_code: "saga", metric: "students", value: 0 },
    { base_code: "saga", metric: "partner_univ", value: 0 },
  ],
  activities: [
    { id: "a1", base_name: "長崎", kind: "system", title: "デスクリサーチ完了", body: "ターゲットリスト初期充足。T1探索フェーズへ。", is_big: false, actor_name: "事務局", created_at: "2026-06-28" },
    { id: "a2", base_name: "大分", kind: "status", title: "ジェイリース：商談中に前進", body: "コミット希望額1,000万円で協議開始。", is_big: false, actor_name: "事務局", created_at: "2026-06-26" },
    { id: "a3", base_name: "熊本", kind: "trigger", title: "T1 地域の紹介役合意 成立", body: "紹介協力の合意獲得。3ヶ月時計スタート、戦略会議に向け興味人材の収集開始。", is_big: true, actor_name: "事務局", created_at: "2026-06-25" },
    { id: "a4", base_name: "大分", kind: "status", title: "学生リーダー候補と面談", body: "APU 3年 K氏。学生事務局の構想に強い関心。", is_big: false, actor_name: "事務局", created_at: "2026-06-21" },
    { id: "a5", base_name: "大分", kind: "trigger", title: "T2 現地立上げ戦略会議 成立", body: "参加9名・宿題持ち帰り3名。「俺たちのプロジェクト」の空気に。", is_big: true, actor_name: "事務局", created_at: "2026-06-20" },
    { id: "a6", base_name: "大分", kind: "status", title: "APU 地域連携室と面談", body: "学生供給・共同プロジェクトの座組みを協議。", is_big: false, actor_name: "事務局", created_at: "2026-06-18" },
    { id: "a7", base_name: "大分", kind: "trigger", title: "T1 地域の紹介役合意 成立", body: "地場金融OB ◯◯氏が紹介役に合意。⏱ 3ヶ月時計スタート。", is_big: true, actor_name: "事務局", created_at: "2026-06-02" },
  ],
  editorial: [
    { base_code: "oita", note: "自治体関係者の確保が最後のピース。市 商工労政課へ紹介ルートでアプローチ", ready: "準備室ロール 3/5 確保・1名検討中" },
    { base_code: "kumamoto", note: "興味人材あと2名で開催ライン。◯◯氏の紹介2件を今週アポ", ready: "燃料：興味人材 4/6名" },
    { base_code: "nagasaki", note: "商工会議所ルートと大学ルートの2本で紹介役候補を探索中", ready: "候補2名と接触済み・合意未取得" },
    { base_code: "saga", note: "リスト作成中。紹介起点の候補洗い出しから", ready: "デスクリサーチ進行中" },
  ],
};
