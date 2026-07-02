"use server";

// =============================================================================
// Server Actions（書き込みは必ずサーバー経由・service_role 使用）。
// Supabase 未設定時は demo モードとして成功扱いを返す（UI は楽観的に反映）。
// =============================================================================

import { revalidatePath } from "next/cache";
import { getServiceClient } from "@/lib/supabase";
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

// ---- ステークホルダーのインライン更新（ステータス / 次回アクション / 金額）----
export interface UpdateStakeholderInput {
  id: string;
  status?: StatusName;
  nextAction?: string;
  commitAmount?: number | null;
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

  const { error } = await db.from("stakeholders").update(patch).eq("id", input.id);
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
