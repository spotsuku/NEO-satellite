"use client";

import type { BaseView, Trigger } from "@/lib/types";
import { YEN, pct } from "@/lib/domain";
import Silhouette from "./Silhouette";
import MoneyBar from "./MoneyBar";
import { buildChecklist } from "./TriggerChecklist";

// 成立条件チェックの進捗（自動判定＋保存済み手動チェック。期限などの付帯項目は除外）
function ckProgress(t: Trigger, base: BaseView, checked: boolean[]): { done: number; total: number } {
  const items = buildChecklist(t, base);
  const work = items
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => !it.meta);
  const done = work.filter(({ it, i }) => (it.done === null ? Boolean(checked?.[i]) : it.done)).length;
  return { done, total: work.length };
}

function PrepDots({ base }: { base: BaseView }) {
  return (
    <span className="pdots">
      {base.prep.map((p, i) => {
        const style =
          p.state === "確保"
            ? { background: "var(--green)", borderColor: "var(--green)" }
            : p.state === "検討中"
              ? { background: "var(--yellow)", borderColor: "var(--yellow)" }
              : { borderColor: "var(--lgray)" };
        return <span className="pd" key={i} style={style} title={`${p.roleName}：${p.stakeholderName ?? ""}`} />;
      })}
    </span>
  );
}

function Chain({
  base,
  triggers,
  checkedFor,
  onDotClick,
}: {
  base: BaseView;
  triggers: Trigger[];
  checkedFor: (baseCode: string, triggerCode: string) => boolean[];
  onDotClick: (baseCode: string, trigger: Trigger) => void;
}) {
  const doneSet = new Set(base.achievedCodes);
  return (
    <div className="chain">
      {triggers.map((t, i) => {
        const done = doneSet.has(t.code);
        const now = t.code === base.next.code;
        const prevDone = i > 0 && doneSet.has(triggers[i - 1].code);
        // 未成立でもチェックが埋まり始めたら黄色リングで「進行中」を示す
        const p = done ? null : ckProgress(t, base, checkedFor(base.code, t.code));
        const inProgress = p !== null && p.done > 0;
        return (
          <span key={t.code} style={{ display: "contents" }}>
            {i > 0 && <span className={`cl ${prevDone && done ? "done" : ""}`} />}
            <span
              className={`cd ${done ? "done" : now ? "now" : ""}${inProgress ? " prog" : ""}`}
              style={{ cursor: "pointer" }}
              title={`${t.code} ${t.name}${
                done
                  ? "（成立済み）"
                  : `${inProgress ? `\n進行中: 成立条件 ${p!.done}/${p!.total} 完了` : ""}\n成立条件: ${t.criteria}\nクリックで成立を記録`
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onDotClick(base.code, t);
              }}
            />
          </span>
        );
      })}
    </div>
  );
}

export default function BoardCards({
  bases,
  triggers,
  checkedFor,
  onSelectBase,
  onDotClick,
}: {
  bases: BaseView[];
  triggers: Trigger[];
  checkedFor: (baseCode: string, triggerCode: string) => boolean[];
  onSelectBase: (code: string) => void;
  onDotClick: (baseCode: string, trigger: Trigger) => void;
}) {
  const goalCode = triggers.find((t) => t.autoRule === "goal_reached")?.code ?? "T8";
  return (
    <div className="cards" id="board">
      {bases.map((b) => {
        const prog = b.done / b.triggersTotal;
        const warn = b.daysLeft !== null && b.daysLeft <= 30;
        return (
          <div className="card" key={b.code} onClick={() => onSelectBase(b.code)}>
            <div className="ctop">
              <div className="cn">
                {b.name}
                <small>{b.nameEn}</small>
              </div>
              <div className="pct">
                {b.done}
                <small>/{b.triggersTotal} 成立</small>
              </div>
            </div>

            <Silhouette id={b.code} path={b.silhouettePath} progress={prog} />
            <Chain base={b} triggers={triggers} checkedFor={checkedFor} onDotClick={onDotClick} />

            <div className="mrow">
              <span>加盟金</span>
              <span>
                <b>{YEN(b.money.fixed)}</b> / {YEN(b.goalAmount)}万
              </span>
            </div>
            <MoneyBar money={b.money} goal={b.goalAmount} />

            <div className="fgrid">
              <div className="fg">
                <span className="fl">興味人材</span> <span className="fv">{b.fuels.interest}名</span>
                <div className="ft">
                  <i style={{ width: `${pct(b.fuels.interest, b.fuelTargets.interest)}%`, background: "var(--ink)" }} />
                </div>
              </div>
              <div className="fg">
                <span className="fl">会員LOI</span> <span className="fv">{b.fuels.loi}社</span>
                <div className="ft">
                  <i style={{ width: `${pct(b.fuels.loi, b.fuelTargets.loi)}%`, background: "var(--cyan)" }} />
                </div>
              </div>
              <div className="fg">
                <span className="fl">学生登録</span> <span className="fv">{b.fuels.students}名</span>
                <div className="ft">
                  <i style={{ width: `${pct(b.fuels.students, b.fuelTargets.students)}%`, background: "var(--pink)" }} />
                </div>
              </div>
              <div className="fg">
                <span className="fl">ﾊﾟｰﾄﾅｰ校</span>{" "}
                <span className="fv">
                  {b.fuels.partner_univ}/{b.fuelTargets.partner_univ}
                </span>
                <div className="ft">
                  <i
                    style={{
                      width: `${pct(b.fuels.partner_univ, b.fuelTargets.partner_univ)}%`,
                      background: "var(--green)",
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="prep-row">
              <span className="fl">準備室ロール</span>
              <PrepDots base={b} />
              <span className="fv">
                {b.prepSecured}/{b.prepTotal}
              </span>
            </div>

            {b.daysLeft === null ? (
              <div className="ddl idle">⏱ T1成立で3ヶ月時計スタート</div>
            ) : (
              <div className="ddl">
                <span>⏱ {goalCode}（{YEN(b.goalAmount)}万）期限 {b.deadlineLabel}</span>
                <b style={{ color: warn ? "var(--red)" : "var(--ink)" }}>
                  {b.daysLeft >= 0 ? `残り${b.daysLeft}日` : `超過${-b.daysLeft}日`}
                </b>
                <div className="dt">
                  <i style={{ width: `${b.clockPct}%`, background: warn ? "var(--red)" : "var(--ink)" }} />
                </div>
              </div>
            )}

            {b.staleCount > 0 && (
              <div style={{ fontSize: 10, color: "var(--red)", fontWeight: 700, margin: "0 0 8px" }}>
                ⚠ 停滞 {b.staleCount}件
              </div>
            )}

            <span
              className="nx nx-btn"
              title={`クリックで ${b.next.code} の成立を記録`}
              onClick={(e) => {
                e.stopPropagation();
                const t = triggers.find((x) => x.code === b.next.code);
                if (t) onDotClick(b.code, t);
              }}
            >
              <b>NEXT</b>
              {b.next.code} {b.next.name}
              {(() => {
                const t = triggers.find((x) => x.code === b.next.code);
                if (!t) return null;
                const p = ckProgress(t, b, checkedFor(b.code, t.code));
                return p.done > 0 ? (
                  <span style={{ color: "var(--yellow)", fontWeight: 800, marginLeft: 6 }}>
                    {p.done}/{p.total} 進行中
                  </span>
                ) : null;
              })()}
              <span className="nxrec">✎ 記録</span>
            </span>
            <div className="cardacts">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const t = triggers.find((x) => x.code === b.next.code);
                  if (t) onDotClick(b.code, t);
                }}
              >
                ✎ 成立を記録
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectBase(b.code);
                }}
                title="詳細の「トリガー状態」で成立/取り消しを一覧操作"
              >
                ⟲ 状態を手動変更
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
