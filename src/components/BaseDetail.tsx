"use client";

import { useState } from "react";
import type { BaseView, Trigger, Stakeholder, StatusDef, PrepState } from "@/lib/types";
import { YEN, pct } from "@/lib/domain";
import { updatePrepAssignment, recordFuelMetrics } from "@/app/actions";
import MoneyBar from "./MoneyBar";
import TriggerChecklist from "./TriggerChecklist";

const PREP_CYCLE: Record<PrepState, PrepState> = { 未: "検討中", 検討中: "確保", 確保: "未" };

function FuelModal({
  base,
  recorderName,
  onClose,
}: {
  base: BaseView;
  recorderName: string;
  onClose: () => void;
}) {
  const [v, setV] = useState({ ...base.fuels });
  const [busy, setBusy] = useState(false);
  const fields: { key: keyof typeof v; label: string }[] = [
    { key: "interest", label: "興味人材（名）" },
    { key: "loi", label: "会員LOI（社）" },
    { key: "students", label: "学生登録（名）" },
    { key: "partner_univ", label: "パートナー校" },
  ];
  async function save() {
    setBusy(true);
    const changed = Object.fromEntries(
      fields.filter((f) => v[f.key] !== base.fuels[f.key]).map((f) => [f.key, v[f.key]]),
    );
    await recordFuelMetrics({ baseCode: base.code, values: changed, actorName: recorderName });
    setBusy(false);
    onClose();
  }
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="mhd">
          <div>
            <div className="mk">FUEL</div>
            <h3>{base.name} — 燃料を記録</h3>
          </div>
          <button className="x" onClick={onClose} aria-label="閉じる">×</button>
        </div>
        <div className="mbd">
          <p style={{ fontSize: 12, color: "var(--gray)", lineHeight: 1.7 }}>
            件数・金額は「次のトリガーを起こす燃料」。最新値を追記します（履歴は残ります）。
          </p>
          {fields.map((f) => (
            <div key={f.key}>
              <label>{f.label}</label>
              <input
                type="number"
                value={v[f.key]}
                min={0}
                onChange={(e) => setV((p) => ({ ...p, [f.key]: Number(e.target.value) }))}
              />
            </div>
          ))}
          <div className="mfoot">
            <button className="save" onClick={save} disabled={busy}>
              {busy ? "保存中…" : "記録する"}
            </button>
            <button className="cancel" onClick={onClose}>キャンセル</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BaseDetail({
  base,
  triggers,
  stakeholders,
  statuses,
  recorderName,
  usingSupabase,
  checklistChecked,
  onChecklistToggle,
  onRecord,
  onUnrecord,
  onClose,
}: {
  base: BaseView;
  triggers: Trigger[];
  stakeholders: Stakeholder[];
  statuses: StatusDef[];
  recorderName: string;
  usingSupabase: boolean;
  checklistChecked: (triggerCode: string) => boolean[];
  onChecklistToggle: (triggerCode: string, itemIndex: number) => void;
  onRecord: (triggerCode: string) => void;
  onUnrecord: (triggerCode: string) => void;
  onClose: () => void;
}) {
  // 準備室ロールの楽観的上書き（roleName → state）
  const [prepOverride, setPrepOverride] = useState<Record<string, PrepState>>({});
  const [showFuel, setShowFuel] = useState(false);

  async function cyclePrep(roleName: string, current: PrepState) {
    const next = PREP_CYCLE[current];
    setPrepOverride((o) => ({ ...o, [roleName]: next }));
    await updatePrepAssignment({ baseCode: base.code, roleName, state: next, actorName: recorderName });
  }
  const m = base.money;
  const sh = stakeholders.filter((s) => s.baseCode === base.code);
  const nextT = triggers.find((t) => t.code === base.next.code);
  const statusColor = (name: string) => statuses.find((s) => s.name === name)?.color ?? "var(--gray)";
  const statusFilled = (name: string) => name !== "未アプローチ";

  return (
    <div className="detail on" id="detail">
      <div className="dhead">
        <h2>{base.name}</h2>
        <span className="en" style={{ fontSize: 10, color: "var(--gray)" }}>
          {base.nameEn}
        </span>
        <span className="st">次のトリガー：{base.next.code} {base.next.name}</span>
        {base.daysLeft !== null && (
          <span className="st" style={{ color: base.daysLeft <= 30 ? "var(--red)" : "#fff" }}>
            ⏱ T7期限 {base.deadlineLabel}（
            {base.daysLeft >= 0 ? `残り${base.daysLeft}日` : `超過${-base.daysLeft}日`}）
          </span>
        )}
        <button className="x" onClick={onClose} aria-label="閉じる">
          ×
        </button>
      </div>

      {/* T3 / T7 成立提案バナー（自動成立はしない） */}
      {base.proposeT3 && (
        <div className="propose">
          <span className="pk">PROPOSAL</span>
          <div>
            <div className="pt">T3 準備室発足の条件を満たしました</div>
            <div className="ps">5ロールすべて「確保」。成立にしますか？（成立日・証拠の入力が必要です）</div>
          </div>
          <button className="rec-btn solid" onClick={() => onRecord("T3")}>
            T3成立を記録
          </button>
        </div>
      )}
      {base.proposeT7 && (
        <div className="propose">
          <span className="pk">PROPOSAL</span>
          <div>
            <div className="pt">T7 加盟金{YEN(base.goalAmount)}万円を達成しました</div>
            <div className="ps">確定合計が目標に到達。成立にしますか？（成立日・証拠の入力が必要です）</div>
          </div>
          <button className="rec-btn solid" onClick={() => onRecord("T7")}>
            T7成立を記録
          </button>
        </div>
      )}

      <div className="dgrid">
        <div className="dcol">
          <h3>3-Layer Gauges</h3>

          <div className="layer">
            <div className="ln">
              <b>🏦 オーナー加盟金</b>
              <span className="v" style={{ color: "var(--green)" }}>
                {YEN(m.fixed)}
                <small style={{ fontSize: 11, color: "var(--lgray)" }}> / {YEN(base.goalAmount)}万</small>
              </span>
            </div>
            <MoneyBar money={m} goal={base.goalAmount} />
            <div className="cap">
              <span>
                <span className="sw" style={{ background: "var(--green)" }} />
                確定 {YEN(m.fixed)}万
              </span>
              <span>
                <span className="sw" style={{ background: "var(--pink)" }} />
                内諾 {YEN(Math.max(0, m.withSoft - m.fixed))}万
              </span>
              <span>
                <span className="sw" style={{ background: "var(--cyan)", opacity: 0.5 }} />
                加重見込み {YEN(m.weighted)}万
              </span>
            </div>
          </div>

          <div className="layer">
            <div className="ln">
              <b>🏢 会員（参加企業）</b>
              <span className="v" style={{ color: "var(--cyan)" }}>
                {base.fuels.loi}
                <small style={{ fontSize: 11, color: "var(--lgray)" }}> LOI</small>
              </span>
            </div>
            <div className="track">
              <i style={{ width: `${pct(base.fuels.loi, base.fuelTargets.loi)}%`, background: "var(--cyan)" }} />
            </div>
            <div className="cap">
              <span>目標：オーナー会談までにLOI {base.fuelTargets.loi}社（説得材料）</span>
            </div>
          </div>

          <div className="layer">
            <div className="ln">
              <b>🎓 学生エコシステム</b>
              <span className="v" style={{ color: "var(--pink)" }}>
                {base.fuels.students}
                <small style={{ fontSize: 11, color: "var(--lgray)" }}> 名登録</small>
              </span>
            </div>
            <div className="track">
              <i style={{ width: `${pct(base.fuels.students, base.fuelTargets.students)}%`, background: "var(--pink)" }} />
            </div>
            <div className="cap">
              <span>
                パートナー校 {base.fuels.partner_univ}/{base.fuelTargets.partner_univ}
              </span>
            </div>
          </div>

          <h3 style={{ marginTop: 6 }}>準備室ロール（T3の成立条件：各1名以上）</h3>
          <table style={{ marginBottom: 16 }}>
            <tbody>
              {base.prep.map((p) => {
                const state = prepOverride[p.roleName] ?? p.state;
                const col =
                  state === "確保" ? "var(--green)" : state === "検討中" ? "var(--yellow)" : "var(--lgray)";
                return (
                  <tr key={p.roleName}>
                    <td style={{ width: "38%" }}>
                      <b>{p.roleName}</b>
                    </td>
                    <td className="dim">{p.stakeholderName ?? "—"}</td>
                    <td style={{ width: 70 }}>
                      <span
                        className={`stat ${state !== "未" ? "filled" : ""}`}
                        style={{ ["--dc" as string]: col, cursor: "pointer" }}
                        title="クリックで 未 → 検討中 → 確保 を切替"
                        onClick={() => cyclePrep(p.roleName, state)}
                      >
                        {state}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="nextact">
            <div className="nl">NEXT TRIGGER</div>
            <div className="nv">
              {base.next.code} {base.next.name}
            </div>
            <div className="nd">
              {base.next.note ?? nextT?.description ?? "次のトリガー成立を目指しています。"}
              {base.next.ready && (
                <>
                  <br />
                  {base.next.ready}
                </>
              )}
            </div>
            {nextT && (
              <div style={{ marginTop: 10, borderTop: "1px solid #333", paddingTop: 10 }}>
                <TriggerChecklist
                  trigger={nextT}
                  base={base}
                  dark
                  checked={checklistChecked(nextT.code)}
                  onToggle={(i) => onChecklistToggle(nextT.code, i)}
                />
              </div>
            )}
          </div>

          <button className="rec-btn" onClick={() => onRecord(base.next.code)}>
            ▶ イベント成立を記録
          </button>{" "}
          <button className="rec-btn" style={{ borderColor: "var(--cyan)", color: "var(--cyan)" }} onClick={() => setShowFuel(true)}>
            ⛽ 燃料を記録
          </button>
        </div>

        <div className="dcol">
          <h3>トリガー状態（手動変更）</h3>
          <table style={{ marginBottom: 20 }}>
            <tbody>
              {triggers.map((t) => {
                const achieved = base.achievedCodes.includes(t.code);
                const log = base.history.find((h) => h.title.startsWith(`${t.code} `));
                return (
                  <tr key={t.code}>
                    <td style={{ width: 42 }}>
                      <b>{t.code}</b>
                    </td>
                    <td>{t.name}</td>
                    <td style={{ width: 110 }}>
                      {achieved ? (
                        <span className="stat filled" style={{ ["--dc" as string]: "var(--green)" }}>
                          成立 {log ? log.date : ""}
                        </span>
                      ) : (
                        <span className="stat" style={{ ["--dc" as string]: "var(--lgray)", color: "var(--gray)" }}>
                          未成立
                        </span>
                      )}
                    </td>
                    <td style={{ width: 86, textAlign: "right" }}>
                      {achieved ? (
                        <button
                          className="rec-btn"
                          style={{ margin: 0, padding: "3px 10px", fontSize: 11, borderColor: "var(--line)", color: "var(--gray)" }}
                          title={`${t.code} の成立を取り消して未成立に戻す`}
                          onClick={() => {
                            if (window.confirm(`${t.code} ${t.name} の成立を取り消して未成立に戻しますか？\n（成立記録は削除され、取り消しがアクティビティに残ります）`)) {
                              onUnrecord(t.code);
                            }
                          }}
                        >
                          取り消す
                        </button>
                      ) : (
                        <button
                          className="rec-btn"
                          style={{ margin: 0, padding: "3px 10px", fontSize: 11 }}
                          title={`成立条件: ${t.criteria}`}
                          onClick={() => onRecord(t.code)}
                        >
                          記録する
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!usingSupabase && (
            <p style={{ fontSize: 10.5, color: "var(--red)", margin: "-12px 0 18px" }}>
              ⚠ モックモード（Supabase未設定）: 変更は画面上のみで、再読み込みで元に戻ります。
            </p>
          )}

          <h3>Trigger Log</h3>
          <ul className="tl">
            {base.history.length ? (
              base.history.map((h, i) => (
                <li key={i}>
                  <div className="td">{h.date}</div>
                  <div className="tt">{h.title}</div>
                  <div className="tx">{h.evidence}</div>
                </li>
              ))
            ) : (
              <li className="pending">
                <div className="tt dim">まだ記録がありません</div>
                <div className="tx">最初のトリガー成立を待っています。</div>
              </li>
            )}
          </ul>

          <h3 style={{ marginTop: 24 }}>Stakeholders（{sh.length}）</h3>
          <table>
            <tbody>
              {sh.length ? (
                sh.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {s.name}
                      {s.isSample && <span className="samp">サンプル</span>}
                    </td>
                    <td className="dim">{s.category}</td>
                    <td>
                      <span
                        className={`stat ${statusFilled(s.status) ? "filled" : ""}`}
                        style={{ ["--dc" as string]: statusColor(s.status) }}
                      >
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="dim">未登録</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showFuel && <FuelModal base={base} recorderName={recorderName} onClose={() => setShowFuel(false)} />}
    </div>
  );
}
