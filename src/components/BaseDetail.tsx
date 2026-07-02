"use client";

import type { BaseView, Trigger, Stakeholder, StatusDef } from "@/lib/types";
import { YEN, pct } from "@/lib/domain";
import MoneyBar from "./MoneyBar";

export default function BaseDetail({
  base,
  triggers,
  stakeholders,
  statuses,
  onRecord,
  onClose,
}: {
  base: BaseView;
  triggers: Trigger[];
  stakeholders: Stakeholder[];
  statuses: StatusDef[];
  onRecord: (triggerCode: string, triggerName: string) => void;
  onClose: () => void;
}) {
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
          <button className="rec-btn solid" onClick={() => onRecord("T3", "準備室発足")}>
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
          <button className="rec-btn solid" onClick={() => onRecord("T7", "加盟金3000万円達成")}>
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
                const col =
                  p.state === "確保" ? "var(--green)" : p.state === "検討中" ? "var(--yellow)" : "var(--lgray)";
                return (
                  <tr key={p.roleName}>
                    <td style={{ width: "38%" }}>
                      <b>{p.roleName}</b>
                    </td>
                    <td className="dim">{p.stakeholderName ?? "—"}</td>
                    <td style={{ width: 70 }}>
                      <span
                        className={`stat ${p.state !== "未" ? "filled" : ""}`}
                        style={{ ["--dc" as string]: col }}
                      >
                        {p.state}
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
          </div>

          <button className="rec-btn" onClick={() => onRecord(base.next.code, base.next.name)}>
            ▶ イベント成立を記録
          </button>
        </div>

        <div className="dcol">
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
    </div>
  );
}
