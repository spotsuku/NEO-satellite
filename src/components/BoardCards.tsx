"use client";

import type { BaseView, Trigger } from "@/lib/types";
import { YEN, pct } from "@/lib/domain";
import Silhouette from "./Silhouette";
import MoneyBar from "./MoneyBar";

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

function Chain({ base, triggers }: { base: BaseView; triggers: Trigger[] }) {
  return (
    <div className="chain">
      {triggers.map((t, i) => (
        <span key={t.code} style={{ display: "contents" }}>
          {i > 0 && <span className={`cl ${i < base.done ? "done" : ""}`} />}
          <span
            className={`cd ${i < base.done ? "done" : i === base.done ? "now" : ""}`}
            title={`${t.code} ${t.name}`}
          />
        </span>
      ))}
    </div>
  );
}

export default function BoardCards({
  bases,
  triggers,
  onSelectBase,
}: {
  bases: BaseView[];
  triggers: Trigger[];
  onSelectBase: (code: string) => void;
}) {
  return (
    <div className="cards" id="board">
      {bases.map((b) => {
        const prog = b.done / b.triggersTotal;
        const nowT = triggers[Math.min(b.done, triggers.length - 1)];
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
            <Chain base={b} triggers={triggers} />

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
                <span>⏱ T7（{YEN(b.goalAmount)}万）期限 {b.deadlineLabel}</span>
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

            <span className="nx">
              <b>NEXT</b>
              {nowT.code} {nowT.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
