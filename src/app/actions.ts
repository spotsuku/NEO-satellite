"use server";

// =============================================================================
// Server Actions（書き込みは必ずサーバー経由・service_role 使用）。
// Supabase 未設定時は demo モードとして成功扱いを返す（UI は楽観的に反映）。
// =============================================================================

import { revalidatePath } from "next/cache";
import { getServiceClient } from "@/lib/supabase";
import { generateSilhouette } from "@/lib/silhouette";
import type { StatusName } from "@/lib/types";

export interface ActionResult {
  ok: boolean;
  demo?: boolean; // Supabase 未設定（書き込みは永続化されない）
  error?: string;
}

// ---- トリガーイベント成立の記録 ----
export interface RecordTriggerInput {
  baseCode: string;
  triggerCode: string;
  achievedOn: string; // YYYY-MM-DD
  participants: string;
  evidence: string;
  recordedBy: string;
}

export async function recordTriggerEvent(input: RecordTriggerInput): Promise<ActionResult> {
  if (!input.evidence?.trim()) return { ok: false, error: "成立の証拠は必須です" };
  if (!input.achievedOn) return { ok: false, error: "成立日は必須です" };
  if (!input.recordedBy?.trim()) return { ok: false, error: "記録者が未設定です" };

  const db = getServiceClient();
  if (!db) return { ok: true, demo: true }; // モックモード

  const { data: base } = await db.from("bases").select("id").eq("code", input.baseCode).single();
  const { data: trg } = await db.from("triggers").select("id").eq("code", input.triggerCode).single();
  if (!base || !trg) return { ok: false, error: "拠点またはトリガーが見つかりません" };

  const { error } = await db.from("trigger_events").insert({
    base_id: base.id,
    trigger_id: trg.id,
    achieved_on: input.achievedOn,
    participants: input.participants || null,
    evidence: input.evidence,
    recorded_by: input.recordedBy,
  });
  if (error) {
    // 一意制約違反（同一拠点で同一トリガー）
    if (error.code === "23505") return { ok: false, error: "このトリガーは既に成立記録済みです" };
    return { ok: false, error: error.message };
  }
  revalidatePath("/");
  return { ok: true };
}

// ---- トリガーイベント成立の取り消し（手動で状態を戻す）----
export async function deleteTriggerEvent(input: {
  baseCode: string;
  triggerCode: string;
  actorName: string;
}): Promise<ActionResult> {
  const db = getServiceClient();
  if (!db) return { ok: true, demo: true };

  const [{ data: base }, { data: trg }] = await Promise.all([
    db.from("bases").select("id,name").eq("code", input.baseCode).single(),
    db.from("triggers").select("id,name").eq("code", input.triggerCode).single(),
  ]);
  if (!base || !trg) return { ok: false, error: "拠点またはトリガーが見つかりません" };

  const { error, count } = await db
    .from("trigger_events")
    .delete({ count: "exact" })
    .eq("base_id", base.id)
    .eq("trigger_id", trg.id);
  if (error) return { ok: false, error: error.message };
  if (!count) return { ok: false, error: "成立記録が見つかりません" };

  // 監査: 取り消しもアクティビティに残す（is_big=false）
  await db.from("activities").insert({
    base_id: base.id,
    kind: "system",
    title: `${input.triggerCode} ${trg.name} の成立を取り消し`,
    body: null,
    is_big: false,
    actor_name: input.actorName,
  });
  revalidatePath("/");
  return { ok: true };
}

// ---- ステークホルダーのインライン更新（ステータス / 次回アクション / 金額）----
export interface UpdateStakeholderInput {
  id: string;
  status?: StatusName;
  nextAction?: string;
  commitAmount?: number | null;
  name?: string;
  contactName?: string;
  actorName: string;
}

export async function updateStakeholder(input: UpdateStakeholderInput): Promise<ActionResult> {
  const db = getServiceClient();
  if (!db) return { ok: true, demo: true };

  const patch: Record<string, unknown> = {
    updated_by: input.actorName,
    last_touched_on: new Date().toISOString().slice(0, 10),
  };
  if (input.status !== undefined) {
    const { data: st } = await db.from("statuses").select("id").eq("name", input.status).single();
    if (!st) return { ok: false, error: "ステータスが見つかりません" };
    patch.status_id = st.id;
  }
  if (input.nextAction !== undefined) patch.next_action = input.nextAction;
  if (input.commitAmount !== undefined) patch.commit_amount = input.commitAmount;
  if (input.name !== undefined) {
    if (!input.name.trim()) return { ok: false, error: "名前は空にできません" };
    patch.name = input.name.trim();
  }
  if (input.contactName !== undefined) patch.contact_name = input.contactName || null;

  const { error } = await db.from("stakeholders").update(patch).eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}

// ---- ステークホルダー削除 ----
// 参照整合: 準備室割当は紐付け解除、マップノードは削除（エッジは cascade）した上で本体を削除。
export async function deleteStakeholder(input: {
  id: string;
  actorName: string;
}): Promise<ActionResult> {
  const db = getServiceClient();
  if (!db) return { ok: true, demo: true };

  const { data: sh } = await db
    .from("stakeholders")
    .select("id,name,base_id")
    .eq("id", input.id)
    .maybeSingle();
  if (!sh) return { ok: false, error: "対象が見つかりません" };

  const { error: prepErr } = await db
    .from("prep_assignments")
    .update({ stakeholder_id: null, updated_by: input.actorName })
    .eq("stakeholder_id", input.id);
  if (prepErr) return { ok: false, error: prepErr.message };

  const { error: nodeErr } = await db.from("map_nodes").delete().eq("stakeholder_id", input.id);
  if (nodeErr) return { ok: false, error: nodeErr.message };

  const { error } = await db.from("stakeholders").delete().eq("id", input.id);
  if (error) return { ok: false, error: error.message };

  await db.from("activities").insert({
    base_id: sh.base_id,
    kind: "system",
    title: `${sh.name} を削除`,
    is_big: false,
    actor_name: input.actorName,
  });
  revalidatePath("/");
  return { ok: true };
}

// ---- ステークホルダー新規追加 ----
export interface CreateStakeholderInput {
  baseCode: string;
  category: string;
  name: string;
  contactName?: string;
  status: StatusName;
  commitAmount?: number | null;
  nextAction?: string;
  actorName: string;
}

export async function createStakeholder(input: CreateStakeholderInput): Promise<ActionResult> {
  if (!input.name?.trim()) return { ok: false, error: "名前は必須です" };
  const db = getServiceClient();
  if (!db) return { ok: true, demo: true };

  const [{ data: base }, { data: cat }, { data: st }] = await Promise.all([
    db.from("bases").select("id").eq("code", input.baseCode).single(),
    db.from("categories").select("id").eq("name", input.category).single(),
    db.from("statuses").select("id").eq("name", input.status).single(),
  ]);
  if (!base || !cat || !st) return { ok: false, error: "拠点・カテゴリ・ステータスが見つかりません" };

  const { error } = await db.from("stakeholders").insert({
    base_id: base.id,
    category_id: cat.id,
    status_id: st.id,
    name: input.name.trim(),
    contact_name: input.contactName || null,
    commit_amount: input.commitAmount ?? null,
    next_action: input.nextAction || null,
    approached_on: new Date().toISOString().slice(0, 10),
    is_sample: false,
    updated_by: input.actorName,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}

// ---- ステークホルダー一括追加（スプレッドシート貼り付け用）----
export interface BulkStakeholderRow {
  baseCode: string;
  category: string;
  name: string;
  contactName?: string;
  status: StatusName;
  commitAmount?: number | null;
  nextAction?: string;
}

export async function createStakeholdersBulk(input: {
  rows: BulkStakeholderRow[];
  actorName: string;
}): Promise<ActionResult & { inserted?: number }> {
  const rows = input.rows.filter((r) => r.name?.trim());
  if (rows.length === 0) return { ok: false, error: "登録対象がありません" };
  const db = getServiceClient();
  if (!db) return { ok: true, demo: true, inserted: rows.length };

  const [{ data: bases }, { data: cats }, { data: sts }] = await Promise.all([
    db.from("bases").select("id,code"),
    db.from("categories").select("id,name"),
    db.from("statuses").select("id,name"),
  ]);
  const baseId = new Map((bases ?? []).map((b) => [b.code, b.id]));
  const catId = new Map((cats ?? []).map((c) => [c.name, c.id]));
  const stId = new Map((sts ?? []).map((s) => [s.name, s.id]));
  const today = new Date().toISOString().slice(0, 10);

  const payload = rows
    .filter((r) => baseId.has(r.baseCode) && catId.has(r.category) && stId.has(r.status))
    .map((r) => ({
      base_id: baseId.get(r.baseCode),
      category_id: catId.get(r.category),
      status_id: stId.get(r.status),
      name: r.name.trim(),
      contact_name: r.contactName?.trim() || null,
      commit_amount: r.commitAmount ?? null,
      next_action: r.nextAction?.trim() || null,
      approached_on: today,
      is_sample: false,
      updated_by: input.actorName,
    }));
  if (payload.length === 0) return { ok: false, error: "拠点・カテゴリ・ステータスを解決できませんでした" };

  const { error, count } = await db.from("stakeholders").insert(payload, { count: "exact" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true, inserted: count ?? payload.length };
}

// ---- 燃料記録（追記型）----
export async function recordFuelMetrics(input: {
  baseCode: string;
  values: Partial<Record<"interest" | "loi" | "students" | "partner_univ", number>>;
  actorName: string;
}): Promise<ActionResult> {
  const db = getServiceClient();
  if (!db) return { ok: true, demo: true };
  const { data: base } = await db.from("bases").select("id").eq("code", input.baseCode).single();
  if (!base) return { ok: false, error: "拠点が見つかりません" };
  const rows = Object.entries(input.values)
    .filter(([, v]) => Number.isFinite(v))
    .map(([metric, value]) => ({
      base_id: base.id,
      metric,
      value,
      recorded_by: input.actorName,
    }));
  if (rows.length === 0) return { ok: true };
  const { error } = await db.from("fuel_metrics").insert(rows);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}

// ---- 関係図マップ（座標は0-1比率・last-write-wins）----
export async function ensureMapHub(baseCode: string): Promise<ActionResult> {
  const db = getServiceClient();
  if (!db) return { ok: true, demo: true };
  const { data: base } = await db.from("bases").select("id").eq("code", baseCode).single();
  if (!base) return { ok: false, error: "拠点が見つかりません" };
  const { data: hub } = await db
    .from("map_nodes")
    .select("id")
    .eq("base_id", base.id)
    .eq("kind", "hub")
    .maybeSingle();
  if (hub) return { ok: true };
  const { error } = await db
    .from("map_nodes")
    .insert({ base_id: base.id, kind: "hub", label: null, x: 0.42, y: 0.42 });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function placeMapNode(input: {
  baseCode: string;
  stakeholderId: string;
  x: number;
  y: number;
  actorName: string;
}): Promise<ActionResult> {
  const db = getServiceClient();
  if (!db) return { ok: true, demo: true };
  const { data: base } = await db.from("bases").select("id").eq("code", input.baseCode).single();
  if (!base) return { ok: false, error: "拠点が見つかりません" };
  const { error } = await db.from("map_nodes").upsert(
    {
      base_id: base.id,
      stakeholder_id: input.stakeholderId,
      kind: "stakeholder",
      x: input.x,
      y: input.y,
      updated_by: input.actorName,
    },
    { onConflict: "base_id,stakeholder_id" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function moveMapNode(input: {
  nodeId: string;
  x: number;
  y: number;
  actorName: string;
}): Promise<ActionResult> {
  const db = getServiceClient();
  if (!db) return { ok: true, demo: true };
  const { error } = await db
    .from("map_nodes")
    .update({ x: input.x, y: input.y, updated_by: input.actorName })
    .eq("id", input.nodeId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function addMapEdge(input: {
  baseCode: string;
  fromNodeId: string;
  toNodeId: string;
  relType: string;
  actorName: string;
}): Promise<ActionResult> {
  const db = getServiceClient();
  if (!db) return { ok: true, demo: true };
  const [{ data: base }, { data: rel }] = await Promise.all([
    db.from("bases").select("id").eq("code", input.baseCode).single(),
    db.from("rel_types").select("id").eq("name", input.relType).single(),
  ]);
  if (!base || !rel) return { ok: false, error: "拠点または関係種別が見つかりません" };
  const { error } = await db.from("map_edges").insert({
    base_id: base.id,
    from_node: input.fromNodeId,
    to_node: input.toNodeId,
    rel_type_id: rel.id,
    created_by: input.actorName,
  });
  if (error && error.code !== "23505") return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function deleteMapEdge(edgeId: string): Promise<ActionResult> {
  const db = getServiceClient();
  if (!db) return { ok: true, demo: true };
  const { error } = await db.from("map_edges").delete().eq("id", edgeId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function resetMapForBase(baseCode: string): Promise<ActionResult> {
  const db = getServiceClient();
  if (!db) return { ok: true, demo: true };
  const { data: base } = await db.from("bases").select("id").eq("code", baseCode).single();
  if (!base) return { ok: false, error: "拠点が見つかりません" };
  // map_edges は from_node の cascade で消える
  const { error } = await db.from("map_nodes").delete().eq("base_id", base.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}

// ---- 準備室ロールの状態更新 ----
export async function updatePrepAssignment(input: {
  baseCode: string;
  roleName: string;
  state: "未" | "検討中" | "確保";
  actorName: string;
}): Promise<ActionResult> {
  const db = getServiceClient();
  if (!db) return { ok: true, demo: true };

  const { data: base } = await db.from("bases").select("id").eq("code", input.baseCode).single();
  const { data: role } = await db
    .from("prep_role_defs")
    .select("id")
    .eq("name", input.roleName)
    .single();
  if (!base || !role) return { ok: false, error: "拠点またはロールが見つかりません" };

  const { error } = await db
    .from("prep_assignments")
    .update({ state: input.state, updated_by: input.actorName })
    .eq("base_id", base.id)
    .eq("role_id", role.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}

// =============================================================================
// 設定（Phase 3）: トリガー文言・確度係数・燃料目標・拠点目標・拠点追加
// =============================================================================

export async function updateTriggerDef(input: {
  code: string;
  name: string;
  description: string;
  criteria?: string;
}): Promise<ActionResult> {
  const db = getServiceClient();
  if (!db) return { ok: true, demo: true };
  const patch: Record<string, string> = { name: input.name, description: input.description };
  if (input.criteria !== undefined) patch.criteria = input.criteria;
  const { error } = await db.from("triggers").update(patch).eq("code", input.code);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true };
}

export async function updateStatusConfidence(input: {
  name: string;
  confidence: number;
}): Promise<ActionResult> {
  if (!(input.confidence >= 0 && input.confidence <= 1))
    return { ok: false, error: "確度は 0〜1 で指定してください" };
  const db = getServiceClient();
  if (!db) return { ok: true, demo: true };
  const { error } = await db
    .from("statuses")
    .update({ confidence: input.confidence })
    .eq("name", input.name);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true };
}

export async function updateFuelTargetSetting(input: {
  key: string; // 'fuel_target_interest' 等
  value: number;
}): Promise<ActionResult> {
  const db = getServiceClient();
  if (!db) return { ok: true, demo: true };
  const { error } = await db
    .from("app_settings")
    .upsert({ key: input.key, value: input.value }, { onConflict: "key" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true };
}

export async function updateBaseGoal(input: {
  code: string;
  goalAmount: number;
}): Promise<ActionResult> {
  if (input.goalAmount <= 0) return { ok: false, error: "目標額は正の値で指定してください" };
  const db = getServiceClient();
  if (!db) return { ok: true, demo: true };
  const { error } = await db
    .from("bases")
    .update({ goal_amount: input.goalAmount })
    .eq("code", input.code);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true };
}

// 拠点追加。県名を指定するとシルエットSVGパスも自動生成（失敗しても拠点は作成）。
export async function createBase(input: {
  code: string;
  name: string;
  nameEn: string;
  goalAmount: number;
  prefName?: string;
}): Promise<ActionResult & { silhouetteGenerated?: boolean }> {
  const code = input.code.trim().toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(code))
    return { ok: false, error: "code は英小文字・数字・ハイフンで指定してください" };
  if (!input.name.trim() || !input.nameEn.trim())
    return { ok: false, error: "拠点名（日本語/英語）は必須です" };

  const db = getServiceClient();
  if (!db) return { ok: true, demo: true };

  let silhouette: string | null = null;
  if (input.prefName?.trim()) {
    try {
      silhouette = await generateSilhouette(input.prefName.trim());
    } catch (e) {
      console.warn("[createBase] シルエット生成に失敗（拠点は作成します）:", e);
    }
  }

  const { data: maxSort } = await db
    .from("bases")
    .select("sort")
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await db.from("bases").insert({
    code,
    name: input.name.trim(),
    name_en: input.nameEn.trim().toUpperCase(),
    goal_amount: input.goalAmount,
    silhouette_path: silhouette,
    sort: (maxSort?.sort ?? 100) + 1,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: `code「${code}」は既に存在します` };
    return { ok: false, error: error.message };
  }
  // 準備室5ロールの割当は DB トリガー（init_prep_assignments）が自動作成
  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true, silhouetteGenerated: silhouette !== null };
}
