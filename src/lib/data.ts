// =============================================================================
// データ取得（サーバー専用）。Supabase 設定時は実データ、未設定時はモック。
// どちらも RawBundle に正規化 → assembler.buildDashboard で DashboardData 化。
// =============================================================================

import "server-only";
import { buildDashboard, type RawBundle } from "./assembler";
import { MOCK_BUNDLE } from "./mockData";
import { getServerReadClient, isSupabaseConfigured } from "./supabase";
import type { DashboardData, StatusName, PrepState } from "./types";

// モックモードの基準日（design モックと揃える）。Supabase モードは実日付。
const MOCK_TODAY = "2026-07-02";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getDashboardData(): Promise<DashboardData> {
  if (!isSupabaseConfigured()) {
    return buildDashboard(MOCK_BUNDLE, MOCK_TODAY, false);
  }
  try {
    const raw = await fetchSupabaseBundle();
    return buildDashboard(raw, todayIso(), true);
  } catch (err) {
    console.error("[data] Supabase 取得に失敗、モックにフォールバックします:", err);
    return buildDashboard(MOCK_BUNDLE, MOCK_TODAY, false);
  }
}

type Rel<T> = T | T[] | null;
function one<T>(v: Rel<T>): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v ?? null;
}

async function fetchSupabaseBundle(): Promise<RawBundle> {
  const db = getServerReadClient();
  if (!db) throw new Error("read client unavailable");

  const [
    bases,
    triggers,
    statuses,
    categories,
    relTypes,
    stakeholders,
    triggerEvents,
    prep,
    fuels,
    activities,
    mapNodes,
    mapEdges,
    fuelTargets,
    settings,
  ] = await Promise.all([
    db.from("bases").select("*").eq("is_active", true).order("sort"),
    db.from("triggers").select("*").order("sort"),
    db.from("statuses").select("*").order("sort"),
    db.from("categories").select("*").order("sort"),
    db.from("rel_types").select("name,color").order("sort"),
    db
      .from("stakeholders")
      .select(
        "id,name,contact_name,title,commit_amount,approached_on,last_touched_on,next_action,next_action_due,link,is_sample,bases(code),categories(name,uses_amount),statuses(name)",
      ),
    db
      .from("trigger_events")
      .select("achieved_on,participants,evidence,recorded_by,bases(code),triggers(code)"),
    db
      .from("prep_assignments")
      .select("state,bases(code),prep_role_defs(name,sort),stakeholders(name)"),
    db.from("fuel_metrics").select("metric,value,noted_on,bases(code)").order("noted_on", { ascending: false }),
    db.from("activities").select("*,bases(name)").order("created_at", { ascending: false }).limit(300),
    db.from("map_nodes").select("*,bases(code)"),
    db.from("map_edges").select("id,from_node,to_node,bases(code),rel_types(name)"),
    db.from("fuel_targets").select("metric,target,bases(code)"),
    db.from("app_settings").select("key,value"),
  ]);

  const firstError =
    bases.error ||
    triggers.error ||
    statuses.error ||
    categories.error ||
    relTypes.error ||
    stakeholders.error ||
    triggerEvents.error ||
    prep.error ||
    fuels.error ||
    activities.error ||
    mapNodes.error ||
    mapEdges.error ||
    fuelTargets.error ||
    settings.error;
  if (firstError) throw firstError;

  // チェックリスト進捗（テーブル未作成の既存DBでも全体を落とさない）
  let checklistProgress: RawBundle["checklistProgress"] = [];
  try {
    const ck = await db
      .from("trigger_checklist_progress")
      .select("item_index,checked,bases(code),triggers(code)");
    if (!ck.error) {
      checklistProgress = ((ck.data ?? []) as any[]).map((c) => ({
        base_code: one<any>(c.bases)?.code ?? "",
        trigger_code: one<any>(c.triggers)?.code ?? "",
        item_index: c.item_index,
        checked: c.checked,
      }));
    }
  } catch {
    // schema.sql 未適用（trigger_checklist_progress なし）は無視
  }

  // 状況メモ・下書き（テーブル未作成でも全体を落とさない）
  let triggerNotes: RawBundle["triggerNotes"] = [];
  try {
    const tn = await db
      .from("trigger_notes")
      .select("note,draft_achieved_on,draft_participants,draft_evidence,updated_by,bases(code),triggers(code)");
    if (!tn.error) {
      triggerNotes = ((tn.data ?? []) as any[]).map((n) => ({
        base_code: one<any>(n.bases)?.code ?? "",
        trigger_code: one<any>(n.triggers)?.code ?? "",
        note: n.note,
        draft_achieved_on: n.draft_achieved_on,
        draft_participants: n.draft_participants,
        draft_evidence: n.draft_evidence,
        updated_by: n.updated_by,
      }));
    }
  } catch {
    // schema.sql 未適用は無視
  }

  // fuel: (base, metric) ごとに最新（noted_on desc の先頭）
  const seenFuel = new Set<string>();
  const latestFuels: RawBundle["fuels"] = [];
  for (const f of (fuels.data ?? []) as any[]) {
    const code = one<any>(f.bases)?.code;
    if (!code) continue;
    const key = `${code}:${f.metric}`;
    if (seenFuel.has(key)) continue;
    seenFuel.add(key);
    latestFuels.push({ base_code: code, metric: f.metric, value: f.value });
  }

  return {
    bases: (bases.data ?? []) as RawBundle["bases"],
    triggers: (triggers.data ?? []) as RawBundle["triggers"],
    statuses: (statuses.data ?? []) as RawBundle["statuses"],
    categories: (categories.data ?? []).map((c: any) => ({ name: c.name, uses_amount: c.uses_amount })),
    relTypes: (relTypes.data ?? []) as RawBundle["relTypes"],
    stakeholders: ((stakeholders.data ?? []) as any[]).map((s) => ({
      id: s.id,
      base_code: one<any>(s.bases)?.code ?? "",
      category: one<any>(s.categories)?.name ?? "その他",
      status: (one<any>(s.statuses)?.name ?? "未アプローチ") as StatusName,
      name: s.name,
      contact_name: s.contact_name ?? "—",
      title: s.title ?? "",
      commit_amount: s.commit_amount,
      approached_on: s.approached_on,
      last_touched_on: s.last_touched_on,
      next_action: s.next_action ?? "",
      next_action_due: s.next_action_due,
      link: s.link,
      is_sample: s.is_sample ?? false,
    })),
    triggerEvents: ((triggerEvents.data ?? []) as any[]).map((e) => ({
      base_code: one<any>(e.bases)?.code ?? "",
      trigger_code: one<any>(e.triggers)?.code ?? "",
      achieved_on: e.achieved_on,
      participants: e.participants,
      evidence: e.evidence,
      recorded_by: e.recorded_by,
    })),
    prep: ((prep.data ?? []) as any[]).map((p) => ({
      base_code: one<any>(p.bases)?.code ?? "",
      role_name: one<any>(p.prep_role_defs)?.name ?? "",
      sort: one<any>(p.prep_role_defs)?.sort ?? 0,
      state: (p.state ?? "未") as PrepState,
      stakeholder_name: one<any>(p.stakeholders)?.name ?? null,
    })),
    fuels: latestFuels,
    activities: ((activities.data ?? []) as any[]).map((a) => ({
      id: a.id,
      base_name: one<any>(a.bases)?.name ?? null,
      kind: a.kind,
      title: a.title,
      body: a.body,
      is_big: a.is_big,
      actor_name: a.actor_name,
      created_at: a.created_at,
    })),
    mapNodes: ((mapNodes.data ?? []) as any[]).map((n) => ({
      id: n.id,
      base_code: one<any>(n.bases)?.code ?? "",
      stakeholder_id: n.stakeholder_id,
      kind: n.kind,
      label: n.label,
      image_url: n.image_url ?? null,
      url: n.url ?? null,
      memo: n.memo ?? null,
      x: Number(n.x),
      y: Number(n.y),
    })),
    mapEdges: ((mapEdges.data ?? []) as any[]).map((e) => ({
      id: e.id,
      base_code: one<any>(e.bases)?.code ?? "",
      from_node: e.from_node,
      to_node: e.to_node,
      rel_type: one<any>(e.rel_types)?.name ?? "紹介",
    })),
    fuelTargetOverrides: ((fuelTargets.data ?? []) as any[]).map((t) => ({
      base_code: one<any>(t.bases)?.code ?? "",
      metric: t.metric,
      target: t.target,
    })),
    settings: Object.fromEntries(
      ((settings.data ?? []) as any[])
        .filter((s) => typeof s.value === "number" || /^\d+$/.test(String(s.value)))
        .map((s) => [s.key, Number(s.value)]),
    ),
    checklistProgress,
    triggerNotes,
  };
}
