"use client";

import type { BaseView, CompanyKpi, Trigger } from "@/lib/types";
import { YEN, TRIGGER_SHORT } from "@/lib/domain";

export default function Kpis({
  company,
  bases,
  triggers,
  onSelectBase,
}: {
  company: CompanyKpi;
  bases: BaseView[];
  triggers: Trigger[];
  onSelectBase: (code: string) => void;
}) {
  const total = company.goalTotal || 1;
  const oku = (company.goalTotal / 10000).toFixed(1);
  return (
    <div className="kpis" id="kpis">
      <div className="kpi" style={{ ["--bar" as string]: "var(--green)" }}>
        <div className="lb">全社 — 加盟金確定 / 目標 {oku}億</div>
        <div className="num">
          <span className="ac-g">{YEN(company.fixed)}</span>
          <span className="u">万円</span>
        </div>
        <div className="bar">
          <i style={{ width: `${(company.withSoft / total) * 100}%`, background: "var(--pink)", opacity: 0.45 }} />
          <i style={{ width: `${(company.fixed / total) * 100}%`, background: "var(--green)" }} />
        </div>
        <div className="note">
          内諾込み <b className="ac-p">{YEN(company.withSoft)}</b> 万円 ／ 成立イベント{" "}
          <b className="ac-y">{company.eventsDone}</b>/{company.eventsTotal}
        </div>
      </div>

      {bases.map((b) => {
        const nowT = triggers[Math.min(b.done, triggers.length - 1)];
        const pct = Math.round((b.done / b.triggersTotal) * 100);
        return (
          <div
            className="kpi kpib"
            key={b.code}
            style={{ ["--bar" as string]: b.accentColor ?? "var(--yellow)" }}
            onClick={() => onSelectBase(b.code)}
          >
            <div className="bn">
              {b.name}
              <small>{b.nameEn}</small>
            </div>
            <div className="pnum">
              {pct}
              <span className="u">%</span>
            </div>
            <div className="sub">
              成立 <b>{b.done}/{b.triggersTotal}</b> ｜ 加盟金 <b>{YEN(b.money.fixed)}</b>万
              <br />
              次: {nowT.code} {TRIGGER_SHORT[nowT.code] ?? nowT.name}
              {b.daysLeft !== null && (
                <>
                  {" ｜ "}
                  <b style={{ color: b.daysLeft <= 30 ? "var(--red)" : "var(--yellow)" }}>
                    {b.daysLeft >= 0 ? `残${b.daysLeft}日` : `超過${-b.daysLeft}日`}
                  </b>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
