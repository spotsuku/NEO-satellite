"use client";

// =============================================================================
// 設定画面（Phase 3）
// - トリガー文言 / 確度係数 / 燃料目標（全体）/ 拠点別目標額 の編集
// - 拠点追加（県名からシルエットSVGを自動生成）
// マスタ編集なのでデータ投入のみで反映され、コード変更・デプロイ不要（仕様 §7）。
// =============================================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DashboardData } from "@/lib/types";
import {
  createBase,
  updateBaseGoal,
  updateFuelTargetSetting,
  updateStatusConfidence,
  updateTriggerDef,
} from "@/app/actions";

const FUEL_KEYS: { key: string; label: string }[] = [
  { key: "fuel_target_interest", label: "興味人材（名）" },
  { key: "fuel_target_loi", label: "会員LOI（社）" },
  { key: "fuel_target_students", label: "学生登録（名）" },
  { key: "fuel_target_partner_univ", label: "パートナー校" },
];

export default function SettingsClient({ data }: { data: DashboardData }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const demoNote = !data.usingSupabase;

  function notify(ok: boolean, error?: string, demo?: boolean) {
    if (!ok) setMsg(`❌ ${error ?? "保存に失敗しました"}`);
    else if (demo) setMsg("⚠ モックモードのため保存されません（Supabase 設定後に有効）");
    else {
      setMsg("✅ 保存しました");
      router.refresh();
    }
    setTimeout(() => setMsg(null), 4000);
  }

  // ---- 各セクションのローカル状態 ----
  const [trg, setTrg] = useState(
    data.triggers.map((t) => ({
      code: t.code,
      name: t.name,
      description: t.description,
      criteria: t.criteria,
    })),
  );
  const [conf, setConf] = useState(
    data.statuses.map((s) => ({ name: s.name, confidence: s.confidence })),
  );
  const fuelDefaults = data.bases[0]?.fuelTargets;
  const [fuel, setFuel] = useState<Record<string, number>>({
    fuel_target_interest: fuelDefaults?.interest ?? 10,
    fuel_target_loi: fuelDefaults?.loi ?? 20,
    fuel_target_students: fuelDefaults?.students ?? 100,
    fuel_target_partner_univ: fuelDefaults?.partner_univ ?? 8,
  });
  const [goals, setGoals] = useState(
    data.bases.map((b) => ({ code: b.code, name: b.name, goal: b.goalAmount })),
  );
  const [nb, setNb] = useState({ code: "", name: "", nameEn: "", goal: 3000, pref: "" });
  const [busy, setBusy] = useState(false);

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
          <div className="ttl">設定</div>
          <div className="sub">Settings</div>
        </div>
        <div className="right">
          <a href="/" className="name-btn" style={{ display: "inline-block", textDecoration: "none" }}>
            ← ダッシュボードへ戻る
          </a>
        </div>
      </header>

      <main>
        {demoNote && (
          <div className="footnote" style={{ marginTop: 0, borderTop: "none", color: "var(--red)" }}>
            モックモード（Supabase 未設定）のため、この画面の変更は保存されません。
          </div>
        )}
        {msg && (
          <div style={{ position: "fixed", top: 16, right: 16, background: "var(--ink)", color: "#fff", padding: "10px 18px", zIndex: 50, fontSize: 13 }}>
            {msg}
          </div>
        )}

        {/* ---- トリガー文言 ---- */}
        <h3 style={{ fontSize: 12, letterSpacing: ".3em", color: "var(--gray)", borderBottom: "1px solid var(--line)", paddingBottom: 8, margin: "10px 0 14px" }}>
          TRIGGERS — トリガー文言
        </h3>
        <table style={{ marginBottom: 30 }}>
          <thead>
            <tr>
              <th style={{ width: 60 }}>CODE</th>
              <th style={{ width: "22%" }}>名称</th>
              <th style={{ width: "28%" }}>説明（凡例帯の一言）</th>
              <th>成立条件</th>
              <th style={{ width: 90 }} />
            </tr>
          </thead>
          <tbody>
            {trg.map((t, i) => (
              <tr key={t.code}>
                <td><b>{t.code}</b></td>
                <td>
                  <input
                    className="inline-input"
                    value={t.name}
                    onChange={(e) => setTrg((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  />
                </td>
                <td>
                  <input
                    className="inline-input"
                    value={t.description}
                    onChange={(e) => setTrg((p) => p.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
                  />
                </td>
                <td>
                  <textarea
                    className="inline-input"
                    rows={2}
                    style={{ resize: "vertical", lineHeight: 1.5 }}
                    value={t.criteria}
                    onChange={(e) => setTrg((p) => p.map((x, j) => (j === i ? { ...x, criteria: e.target.value } : x)))}
                  />
                </td>
                <td>
                  <button
                    className="rec-btn"
                    style={{ margin: 0, padding: "5px 12px" }}
                    onClick={async () => {
                      const r = await updateTriggerDef(t);
                      notify(r.ok, r.error, r.demo);
                    }}
                  >
                    保存
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ---- 確度係数 ---- */}
        <h3 style={{ fontSize: 12, letterSpacing: ".3em", color: "var(--gray)", borderBottom: "1px solid var(--line)", paddingBottom: 8, margin: "10px 0 14px" }}>
          CONFIDENCE — 金額パイプライン確度係数
        </h3>
        <table style={{ marginBottom: 30, maxWidth: 520 }}>
          <thead>
            <tr>
              <th>ステータス</th>
              <th style={{ width: 130 }}>確度（0〜1）</th>
              <th style={{ width: 90 }} />
            </tr>
          </thead>
          <tbody>
            {conf.map((s, i) => (
              <tr key={s.name}>
                <td><b>{s.name}</b></td>
                <td>
                  <input
                    className="inline-input"
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={s.confidence}
                    onChange={(e) =>
                      setConf((p) => p.map((x, j) => (j === i ? { ...x, confidence: Number(e.target.value) } : x)))
                    }
                  />
                </td>
                <td>
                  <button
                    className="rec-btn"
                    style={{ margin: 0, padding: "5px 12px" }}
                    onClick={async () => {
                      const r = await updateStatusConfidence(s);
                      notify(r.ok, r.error, r.demo);
                    }}
                  >
                    保存
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ---- 燃料目標 ---- */}
        <h3 style={{ fontSize: 12, letterSpacing: ".3em", color: "var(--gray)", borderBottom: "1px solid var(--line)", paddingBottom: 8, margin: "10px 0 14px" }}>
          FUEL TARGETS — 燃料目標（全体デフォルト）
        </h3>
        <table style={{ marginBottom: 30, maxWidth: 520 }}>
          <tbody>
            {FUEL_KEYS.map((f) => (
              <tr key={f.key}>
                <td><b>{f.label}</b></td>
                <td style={{ width: 130 }}>
                  <input
                    className="inline-input"
                    type="number"
                    min={1}
                    value={fuel[f.key]}
                    onChange={(e) => setFuel((p) => ({ ...p, [f.key]: Number(e.target.value) }))}
                  />
                </td>
                <td style={{ width: 90 }}>
                  <button
                    className="rec-btn"
                    style={{ margin: 0, padding: "5px 12px" }}
                    onClick={async () => {
                      const r = await updateFuelTargetSetting({ key: f.key, value: fuel[f.key] });
                      notify(r.ok, r.error, r.demo);
                    }}
                  >
                    保存
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ---- 拠点別目標 ---- */}
        <h3 style={{ fontSize: 12, letterSpacing: ".3em", color: "var(--gray)", borderBottom: "1px solid var(--line)", paddingBottom: 8, margin: "10px 0 14px" }}>
          BASE GOALS — 拠点別 加盟金目標（万円）
        </h3>
        <table style={{ marginBottom: 30, maxWidth: 520 }}>
          <tbody>
            {goals.map((g, i) => (
              <tr key={g.code}>
                <td><b>{g.name}</b></td>
                <td style={{ width: 130 }}>
                  <input
                    className="inline-input"
                    type="number"
                    min={1}
                    value={g.goal}
                    onChange={(e) => setGoals((p) => p.map((x, j) => (j === i ? { ...x, goal: Number(e.target.value) } : x)))}
                  />
                </td>
                <td style={{ width: 90 }}>
                  <button
                    className="rec-btn"
                    style={{ margin: 0, padding: "5px 12px" }}
                    onClick={async () => {
                      const r = await updateBaseGoal({ code: g.code, goalAmount: g.goal });
                      notify(r.ok, r.error, r.demo);
                    }}
                  >
                    保存
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ---- 拠点追加 ---- */}
        <h3 style={{ fontSize: 12, letterSpacing: ".3em", color: "var(--gray)", borderBottom: "1px solid var(--line)", paddingBottom: 8, margin: "10px 0 14px" }}>
          NEW BASE — 拠点追加
        </h3>
        <div style={{ maxWidth: 520, marginBottom: 40 }}>
          <p style={{ fontSize: 12, color: "var(--gray)", marginBottom: 12 }}>
            県名を入れると dataofjapan/land の GeoJSON からシルエットSVGを自動生成します。
            準備室5ロールの割当行も自動作成されます。
          </p>
          <div className="modal" style={{ border: "1px solid var(--line)" }}>
            <div className="mbd">
              <div className="mrow2">
                <div>
                  <label>code（英小文字）<span className="req">*</span></label>
                  <input type="text" value={nb.code} placeholder="fukuoka" onChange={(e) => setNb((p) => ({ ...p, code: e.target.value }))} />
                </div>
                <div>
                  <label>県名（シルエット生成用）</label>
                  <input type="text" value={nb.pref} placeholder="福岡" onChange={(e) => setNb((p) => ({ ...p, pref: e.target.value }))} />
                </div>
              </div>
              <div className="mrow2">
                <div>
                  <label>拠点名<span className="req">*</span></label>
                  <input type="text" value={nb.name} placeholder="福岡" onChange={(e) => setNb((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label>英語表記<span className="req">*</span></label>
                  <input type="text" value={nb.nameEn} placeholder="FUKUOKA" onChange={(e) => setNb((p) => ({ ...p, nameEn: e.target.value }))} />
                </div>
              </div>
              <label>加盟金目標（万円）</label>
              <input type="number" value={nb.goal} min={1} onChange={(e) => setNb((p) => ({ ...p, goal: Number(e.target.value) }))} />
              <div className="mfoot">
                <button
                  className="save"
                  disabled={busy || !nb.code || !nb.name || !nb.nameEn}
                  onClick={async () => {
                    setBusy(true);
                    const r = await createBase({
                      code: nb.code,
                      name: nb.name,
                      nameEn: nb.nameEn,
                      goalAmount: nb.goal,
                      prefName: nb.pref || undefined,
                    });
                    setBusy(false);
                    if (r.ok && !r.demo) {
                      setNb({ code: "", name: "", nameEn: "", goal: 3000, pref: "" });
                      notify(true, undefined, false);
                      setMsg(
                        r.silhouetteGenerated
                          ? "✅ 拠点を追加しました（シルエット生成済み）"
                          : "✅ 拠点を追加しました（シルエットは scripts/gen-silhouette.ts で後から投入可）",
                      );
                    } else {
                      notify(r.ok, r.error, r.demo);
                    }
                  }}
                >
                  {busy ? "作成中…" : "拠点を追加"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="footnote">
          トリガー文言・確度係数・燃料目標・拠点目標はマスタテーブルの編集であり、変更は即座に全画面へ反映されます（デプロイ不要）。
          確度係数を変えると「見込み金額」の表示が変わります。
        </div>
      </main>
    </>
  );
}
