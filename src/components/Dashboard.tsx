"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DashboardData, TriggerNote } from "@/lib/types";
import { applyTriggerEvent, removeTriggerEvent } from "@/lib/optimistic";
import { deleteTriggerEvent, saveTriggerNote, setChecklistItem } from "@/app/actions";
import { getBrowserClient } from "@/lib/supabaseBrowser";
import { Steps, Legend, TriggerInfoModal } from "./StepsLegend";
import type { Trigger } from "@/lib/types";
import Kpis from "./Kpis";
import BoardCards from "./BoardCards";
import BaseDetail from "./BaseDetail";
import StakeholderTable from "./StakeholderTable";
import ActivityFeed from "./ActivityFeed";
import MapView from "./MapView";
import Celebration, { type CelebrationState } from "./Celebration";
import TriggerRecordModal, { type RecordPayload } from "./TriggerRecordModal";
import NameModal from "./NameModal";

type Tab = "board" | "stake" | "map" | "feed";
const NAME_KEY = "neo_actor_name";
const HINT_KEY = "neo_hint_dismissed_v1";
// どのビルドを見ているかの判別用（デプロイ確認）。リリース時に更新。
export const APP_VERSION = "v0.6.1";

export default function Dashboard({ data: initial }: { data: DashboardData }) {
  const router = useRouter();
  const [data, setData] = useState<DashboardData>(initial);
  useEffect(() => setData(initial), [initial]);

  const [tab, setTab] = useState<Tab>("board");
  const [selected, setSelected] = useState<string | null>(null);
  const [cele, setCele] = useState<CelebrationState | null>(null);
  const [recordModal, setRecordModal] = useState<{ baseCode: string; initialCode: string } | null>(null);
  const [infoTrigger, setInfoTrigger] = useState<Trigger | null>(null);

  const [name, setName] = useState<string>("");
  const [showName, setShowName] = useState(false);
  const [nameReady, setNameReady] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const pendingRecord = useRef<{ baseCode: string; initialCode: string } | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const recentLocal = useRef<Set<string>>(new Set());

  // 記録者名（localStorage）
  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(NAME_KEY) : null;
    if (stored) setName(stored);
    else setShowName(true);
    setNameReady(true);
    if (typeof window !== "undefined" && !window.localStorage.getItem(HINT_KEY)) setShowHint(true);
  }, []);

  function dismissHint() {
    setShowHint(false);
    window.localStorage.setItem(HINT_KEY, "1");
  }

  function saveName(n: string) {
    setName(n);
    window.localStorage.setItem(NAME_KEY, n);
    setShowName(false);
    if (pendingRecord.current) {
      setRecordModal(pendingRecord.current);
      pendingRecord.current = null;
    }
  }

  const selectBase = useCallback((code: string) => {
    setSelected(code);
    setTab("board");
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 40);
  }, []);

  function openRecord(baseCode: string, initialCode: string) {
    if (!name) {
      pendingRecord.current = { baseCode, initialCode };
      setShowName(true);
      return;
    }
    setRecordModal({ baseCode, initialCode });
  }

  // ---- 成立条件チェックリスト（保存・共有。段階的に埋まっていく）----
  // 楽観的上書き: `${baseCode}:${triggerCode}` → { itemIndex: checked }
  const [ckOverride, setCkOverride] = useState<Record<string, Record<number, boolean>>>({});

  const checklistChecked = useCallback(
    (baseCode: string, triggerCode: string): boolean[] => {
      const out: boolean[] = [];
      for (const p of data.checklistProgress ?? []) {
        if (p.baseCode === baseCode && p.triggerCode === triggerCode) out[p.itemIndex] = p.checked;
      }
      const ov = ckOverride[`${baseCode}:${triggerCode}`];
      if (ov) for (const [i, v] of Object.entries(ov)) out[Number(i)] = v;
      return out;
    },
    [data.checklistProgress, ckOverride],
  );

  const onChecklistToggle = useCallback(
    (baseCode: string, triggerCode: string, itemIndex: number) => {
      const current = checklistChecked(baseCode, triggerCode)[itemIndex] ?? false;
      const next = !current;
      setCkOverride((p) => ({
        ...p,
        [`${baseCode}:${triggerCode}`]: { ...p[`${baseCode}:${triggerCode}`], [itemIndex]: next },
      }));
      void setChecklistItem({
        baseCode,
        triggerCode,
        itemIndex,
        checked: next,
        actorName: name || "匿名",
      });
    },
    [checklistChecked, name],
  );

  // ---- トリガーの状況メモ＋記録下書き（拠点×トリガー・全員共有）----
  const [noteOverride, setNoteOverride] = useState<Record<string, TriggerNote>>({});

  const noteFor = useCallback(
    (baseCode: string, triggerCode: string): TriggerNote | null =>
      noteOverride[`${baseCode}:${triggerCode}`] ??
      (data.triggerNotes ?? []).find((n) => n.baseCode === baseCode && n.triggerCode === triggerCode) ??
      null,
    [data.triggerNotes, noteOverride],
  );

  const onSaveNote = useCallback(
    async (
      baseCode: string,
      triggerCode: string,
      f: { note: string; draftAchievedOn: string; draftParticipants: string; draftEvidence: string },
    ) => {
      const actorName = name || "匿名";
      setNoteOverride((p) => ({
        ...p,
        [`${baseCode}:${triggerCode}`]: {
          baseCode,
          triggerCode,
          note: f.note,
          draftAchievedOn: f.draftAchievedOn,
          draftParticipants: f.draftParticipants,
          draftEvidence: f.draftEvidence,
          updatedBy: actorName,
        },
      }));
      await saveTriggerNote({
        baseCode,
        triggerCode,
        note: f.note,
        draftAchievedOn: f.draftAchievedOn,
        draftParticipants: f.draftParticipants,
        draftEvidence: f.draftEvidence,
        actorName,
      });
    },
    [name],
  );

  // 成立の取り消し（T2成立 → 未成立に戻す等の手動変更）
  async function onUnrecord(baseCode: string, triggerCode: string) {
    const actorName = name || "匿名";
    const res = await deleteTriggerEvent({ baseCode, triggerCode, actorName });
    if (!res.ok) {
      window.alert(res.error ?? "取り消しに失敗しました");
      return;
    }
    setData((d) => removeTriggerEvent(d, { baseCode, triggerCode, actorName }));
    if (data.usingSupabase) router.refresh();
  }

  // カードの T1〜T8 ドットクリック: モーダルで成立記録／成立済みなら取り消し
  function onDotClick(baseCode: string, trigger: Trigger) {
    selectBase(baseCode);
    openRecord(baseCode, trigger.code);
  }

  function onRecorded(p: RecordPayload) {
    recentLocal.current.add(`${p.baseCode}:${p.triggerCode}`);
    setNoteOverride((prev) => {
      const next = { ...prev };
      delete next[`${p.baseCode}:${p.triggerCode}`];
      return next;
    });
    setData((d) => applyTriggerEvent(d, p));
    setRecordModal(null);
    const base = data.bases.find((b) => b.code === p.baseCode);
    const trg = data.triggers.find((t) => t.code === p.triggerCode);
    setCele({
      code: p.triggerCode,
      title: `${p.triggerCode} ${trg?.name ?? p.triggerCode} 成立`,
      subtitle: `${base?.name ?? ""} — ${p.evidence}`.slice(0, 80),
    });
    if (data.usingSupabase) router.refresh();
  }

  // Realtime: 他メンバーの更新を購読（Supabase モードのみ）。
  // 全テーブルを対象に、連続イベントは 400ms デバウンスでまとめて refresh。
  // 成立演出は activities(is_big) 起点 — 拠点名・T名・証拠つきのリッチ表示。
  useEffect(() => {
    if (!data.usingSupabase) return;
    const db = getBrowserClient();
    if (!db) return;
    const baseNameById = new Map(data.bases.map((b) => [b.id, b.name]));
    const baseCodeById = new Map(data.bases.map((b) => [b.id, b.code]));

    let timer: ReturnType<typeof setTimeout> | null = null;
    const refreshSoon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 400);
    };

    const TABLES = [
      "stakeholders",
      "trigger_events",
      "prep_assignments",
      "fuel_metrics",
      "fuel_targets",
      "map_nodes",
      "map_edges",
      "trigger_checklist_progress",
      "trigger_notes",
      "bases",
      "triggers",
      "statuses",
      "app_settings",
    ];
    let ch = db.channel("neo-realtime").on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "activities" },
      (payload) => {
        refreshSoon();
        const row = payload.new as {
          title?: string;
          body?: string | null;
          is_big?: boolean;
          base_id?: string | null;
        };
        if (!row?.is_big) return;
        const tCode = /^T\d+/.exec(row.title ?? "")?.[0] ?? "";
        const baseCode = row.base_id ? baseCodeById.get(row.base_id) : undefined;
        // 自分が起こした成立（ローカル演出済み）は二重発火しない
        const localKey = `${baseCode}:${tCode}`;
        if (baseCode && tCode && recentLocal.current.has(localKey)) {
          recentLocal.current.delete(localKey);
          return;
        }
        const baseName = row.base_id ? (baseNameById.get(row.base_id) ?? "") : "";
        setCele({
          code: tCode,
          title: row.title ?? "トリガー成立",
          subtitle: `${baseName}${baseName ? " — " : ""}${(row.body ?? "").slice(0, 80)}`,
        });
      },
    );
    for (const table of TABLES) {
      ch = ch.on("postgres_changes", { event: "*", schema: "public", table }, refreshSoon);
    }
    ch.subscribe();

    // 保険: Realtime が届かない構成（publication 未設定等）でも
    // 30秒ごとに再取得して「誰が記入しても更新」を保証する。
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30000);

    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(poll);
      db.removeChannel(ch);
    };
  }, [data.usingSupabase, data.bases, router]);

  const selectedBase = selected ? data.bases.find((b) => b.code === selected) ?? null : null;

  return (
    <>
      <div className="diag-wrap">
        <div className="diag y" />
        <div className="diag p" />
        <div className="diag c" />
      </div>

      <header>
        <div className="ttl">NEO ACADEMIA</div>
        <div>
          <div className="ttl">拠点展開ダッシュボード</div>
          <div className="sub">Satellite Launch Board</div>
        </div>
        <div className="right">
          <div>
            {data.usingSupabase ? "Supabase 接続中" : "モックデータ表示中（Supabase未設定）"} — 最終更新 {data.today} —{" "}
            <b style={{ color: "var(--yellow)" }}>{APP_VERSION}</b>
          </div>
          <button className="name-btn" onClick={() => setShowName(true)} style={{ marginTop: 6 }}>
            記録者：<b>{name || "未設定"}</b>
          </button>{" "}
          <button
            className="name-btn"
            onClick={() => {
              setTab("board");
              setShowHint(true);
            }}
          >
            ？使い方
          </button>{" "}
          <a href="/settings" className="name-btn" style={{ display: "inline-block", textDecoration: "none" }}>
            ⚙ 設定
          </a>
        </div>
      </header>

      <Kpis company={data.company} bases={data.bases} triggers={data.triggers} onSelectBase={selectBase} />

      <nav className="tabs">
        <button className={tab === "board" ? "on" : ""} onClick={() => setTab("board")}>
          拠点ボード
        </button>
        <button className={tab === "stake" ? "on" : ""} onClick={() => setTab("stake")}>
          ステークホルダー
        </button>
        <button className={tab === "map" ? "on" : ""} onClick={() => setTab("map")}>
          関係図マップ
        </button>
        <button className={tab === "feed" ? "on" : ""} onClick={() => setTab("feed")}>
          アクティビティ
        </button>
      </nav>

      <main>
        <section className={`view ${tab === "board" ? "on" : ""}`}>
          {showHint && (
            <div className="hintbar">
              <div>
                <b>使い方</b> — トリガーの成立/取り消しは手動で操作できます：
                ① カードの<b>「✎ 成立を記録」</b>で次のトリガーを記録（T1〜T8のドットやNEXTバーのクリックでも可）
                ② <b>「⟲ 状態を手動変更」</b>で詳細を開き、「トリガー状態」一覧から任意のトリガーを成立⇄取り消し（T2をT1に戻す等）
                ③ 上の<b>ステップ帯（T1〜T8）をクリック</b>すると各トリガーの成立条件が見られます
              </div>
              <button className="hx" onClick={dismissHint} aria-label="閉じる">×</button>
            </div>
          )}
          <Steps triggers={data.triggers} onInfo={setInfoTrigger} />
          <Legend />
          <BoardCards bases={data.bases} triggers={data.triggers} onSelectBase={selectBase} onDotClick={onDotClick} />
          <div ref={detailRef}>
            {selectedBase && (
              <BaseDetail
                base={selectedBase}
                triggers={data.triggers}
                stakeholders={data.stakeholders}
                statuses={data.statuses}
                recorderName={name || "匿名"}
                usingSupabase={data.usingSupabase}
                checklistChecked={(code) => checklistChecked(selectedBase.code, code)}
                onChecklistToggle={(code, i) => onChecklistToggle(selectedBase.code, code, i)}
                nextNote={noteFor(selectedBase.code, selectedBase.next.code)}
                onRecord={(code) => openRecord(selectedBase.code, code)}
                onUnrecord={(code) => onUnrecord(selectedBase.code, code)}
                onClose={() => setSelected(null)}
              />
            )}
          </div>
          <div className="footnote">
            トリガーイベント T1〜T8。T1の成立から3ヶ月以内にT7（加盟金3000万円達成）をやり切るのが立ち上げの基本ルール。
            T3 準備室発足は5ロール（現地紹介者・オーナー企業候補・学生リーダー候補・大学高校関係者・自治体関係者）が各1名以上揃った時点で成立提案。
            イベントは「開催」ではなく成立条件（相手から次のアクションが提案される等）を満たした時点で成立と記録します。
          </div>
        </section>

        <section className={`view ${tab === "stake" ? "on" : ""}`}>
          <StakeholderTable
            stakeholders={data.stakeholders}
            bases={data.bases}
            categories={data.categories}
            statuses={data.statuses}
            today={data.today}
            recorderName={name || "匿名"}
          />
        </section>

        <section className={`view ${tab === "map" ? "on" : ""}`}>
          {tab === "map" && (
            <MapView
              bases={data.bases}
              stakeholders={data.stakeholders}
              relTypes={data.relTypes}
              statuses={data.statuses}
              usingSupabase={data.usingSupabase}
              mapNodes={data.mapNodes}
              mapEdges={data.mapEdges}
              recorderName={name || "匿名"}
            />
          )}
        </section>

        <section className={`view ${tab === "feed" ? "on" : ""}`}>
          <ActivityFeed activities={data.activities} />
        </section>
      </main>

      <Celebration state={cele} onClose={() => setCele(null)} />

      {recordModal && (
        <TriggerRecordModal
          baseCode={recordModal.baseCode}
          baseName={data.bases.find((b) => b.code === recordModal.baseCode)?.name ?? ""}
          base={data.bases.find((b) => b.code === recordModal.baseCode)}
          triggers={data.triggers}
          achievedCodes={data.bases.find((b) => b.code === recordModal.baseCode)?.achievedCodes ?? []}
          initialCode={recordModal.initialCode}
          defaultDate={data.today}
          recordedBy={name || "匿名"}
          usingSupabase={data.usingSupabase}
          checklistChecked={(code) => checklistChecked(recordModal.baseCode, code)}
          onChecklistToggle={(code, i) => onChecklistToggle(recordModal.baseCode, code, i)}
          noteFor={(code) => noteFor(recordModal.baseCode, code)}
          onSaveNote={(code, f) => onSaveNote(recordModal.baseCode, code, f)}
          onCancel={() => setRecordModal(null)}
          onRecorded={onRecorded}
          onUnrecord={(code) => onUnrecord(recordModal.baseCode, code)}
        />
      )}

      {infoTrigger && <TriggerInfoModal trigger={infoTrigger} onClose={() => setInfoTrigger(null)} />}

      {nameReady && showName && (
        <NameModal
          current={name}
          onSave={saveName}
          onClose={() => setShowName(false)}
          dismissable={Boolean(name)}
        />
      )}
    </>
  );
}
