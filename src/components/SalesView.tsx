"use client";

// 営業進捗ビュー: 各拠点の商談ステータス分布・ファネル率・見込み/確定金額を1画面で俯瞰する。
// 金額はオーナー候補（金額あり）の確定/内諾込み/加重見込み（確度係数）を使用。

import type { DashboardData, BaseView, Stakeholder, StatusDef } from "@/lib/types";
import { YEN, REVIEW_ITEMS, pct } from "@/lib/domain";
import MoneyBar from "./MoneyBar";

const IN_TALKS = ["商談中", "検討中", "内諾", "確定"]; // 商談化とみなすステータス
const SOFT = ["内諾", "確定"];

interface BaseSales {
  base: BaseView;
  total: number;
  approached: number;
  inTalks: number;
  soft: number;
  won: number;
  lost: number;
  byStatus: { name: string; color: string; count: number }[];
  reviewAvg: number; // 検討状況チェックの平均クリア数
}

function calc(base: BaseView, stakeholders: Stakeholder[], statuses: StatusDef[]): BaseSales {
  const sh = stakeholders.filter((s) => s.baseCode === base.code);
  const count = (names: string[]) => sh.filter((s) => names.includes(s.status)).length;
  const byStatus = statuses.map((st) => ({
    name: st.name,
    color: st.color,
    count: sh.filter((s) => s.status === st.name).length,
  }));
  const reviewAvg =
    sh.length === 0 ? 0 : sh.reduce((a, s) => a + (s.reviewChecks?.length ?? 0), 0) / sh.length;
  return {
    base,
    total: sh.length,
    approached: sh.filter((s) => s.status !== "未アプローチ").length,
    inTalks: count(IN_TALKS),
    soft: count(SOFT),
    won: count(["確定"]),
    lost: count(["見送り"]),
    byStatus,
    reviewAvg,
  };
}

const rate = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "—");

function StatusBar({ byStatus, total }: { byStatus: BaseSales["byStatus"]; total: number }) {
  if (total === 0) return <div className="sbar"><i style={{ width: "100%", background: "var(--line)" }} /></div>;
  return (
    <div className="sbar">
      {byStatus
        .filter((b) => b.count > 0)
        .map((b) => (
          <i
            key={b.name}
            style={{ width: `${(b.count / total) * 100}%`, background: b.color }}
            title={`${b.name} ${b.count}件`}
          />
        ))}
    </div>
  );
}

function Funnel({ s }: { s: BaseSales }) {
  const rows: [string, number, string][] = [
    ["リスト", s.total, ""],
    ["アプローチ済み", s.approached, rate(s.approached, s.total)],
    ["商談化", s.inTalks, rate(s.inTalks, s.total)],
    ["内諾以上", s.soft, rate(s.soft, s.total)],
    ["確定", s.won, rate(s.won, s.total)],
  ];
  const max = Math.max(1, s.total);
  return (
    <div style={{ display: "grid", gap: 3 }}>
      {rows.map(([label, n, r]) => (
        <div key={label} style={{ display: "grid", gridTemplateColumns: "92px 1fr 64px", gap: 8, alignItems: "center", fontSize: 11 }}>
          <span style={{ color: "var(--gray)" }}>{label}</span>
          <div style={{ height: 10, background: "#F0F0EC", position: "relative" }}>
            <i style={{ position: "absolute", inset: 0, width: `${(n / max) * 100}%`, background: label === "確定" ? "var(--green)" : "var(--ink)", display: "block" }} />
          </div>
          <b style={{ textAlign: "right" }}>
            {n}件{r ? <small style={{ color: "var(--gray)", fontWeight: 400 }}>（{r}）</small> : ""}
          </b>
        </div>
      ))}
    </div>
  );
}

export default function SalesView({ data }: { data: DashboardData }) {
  const sales = data.bases.map((b) => calc(b, data.stakeholders, data.statuses));
  const sum = (f: (s: BaseSales) => number) => sales.reduce((a, s) => a + f(s), 0);
  const goalTotal = data.bases.reduce((a, b) => a + b.goalAmount, 0);
  const fixed = data.bases.reduce((a, b) => a + b.money.fixed, 0);
  const withSoft = data.bases.reduce((a, b) => a + b.money.withSoft, 0);
  const weighted = data.bases.reduce((a, b) => a + b.money.weighted, 0);

  const tiles: [string, string, string][] = [
    ["確定金額（全社）", `${YEN(fixed)}万`, "var(--green)"],
    ["内諾込み", `${YEN(withSoft)}万`, "var(--pink)"],
    ["見込み受注（加重）", `${YEN(weighted)}万`, "var(--cyan)"],
    ["目標達成率", goalTotal > 0 ? `${Math.round((fixed / goalTotal) * 100)}%` : "—", "var(--yellow)"],
  ];

  return (
    <>
      {/* 全社サマリー */}
      <div className="stiles">
        {tiles.map(([label, value, color]) => (
          <div key={label} className="stile" style={{ ["--tc" as string]: color }}>
            <span>{label}</span>
            <b>{value}</b>
          </div>
        ))}
      </div>

      {/* 拠点別カード */}
      <div className="sgrid">
        {sales.map((s) => {
          const b = s.base;
          return (
            <div className="scard" key={b.code}>
              <div className="shead">
                <b>{b.name}</b>
                <small>{b.nameEn}</small>
                <span style={{ marginLeft: "auto", fontSize: 11 }}>
                  確定 <b style={{ color: "var(--green)" }}>{YEN(b.money.fixed)}</b> / {YEN(b.goalAmount)}万
                </span>
              </div>

              <div className="slabel">ステータス分布（{s.total}件）</div>
              <StatusBar byStatus={s.byStatus} total={s.total} />
              <div className="slegend">
                {s.byStatus
                  .filter((x) => x.count > 0)
                  .map((x) => (
                    <span key={x.name}>
                      <i style={{ background: x.color }} />
                      {x.name} {x.count}
                    </span>
                  ))}
                {s.total === 0 && <span className="dim">リスト未登録</span>}
              </div>

              <div className="slabel">ファネル</div>
              <Funnel s={s} />

              <div className="slabel">加盟金（確定 / 内諾込み / 加重見込み）</div>
              <MoneyBar money={b.money} goal={b.goalAmount} />
              <div style={{ display: "flex", gap: 14, fontSize: 11, marginTop: 4 }}>
                <span><i className="sw" style={{ background: "var(--green)" }} />確定 {YEN(b.money.fixed)}万</span>
                <span><i className="sw" style={{ background: "var(--pink)" }} />内諾込み {YEN(b.money.withSoft)}万</span>
                <span><i className="sw" style={{ background: "var(--cyan)" }} />加重 {YEN(b.money.weighted)}万</span>
              </div>

              <div className="slabel">検討状況チェックの平均進捗</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 70px", gap: 8, alignItems: "center" }}>
                <div style={{ height: 8, background: "#F0F0EC" }}>
                  <i style={{ display: "block", height: "100%", width: `${pct(s.reviewAvg, REVIEW_ITEMS.length)}%`, background: "var(--ink)" }} />
                </div>
                <b style={{ fontSize: 11, textAlign: "right" }}>{s.reviewAvg.toFixed(1)}/{REVIEW_ITEMS.length}</b>
              </div>
            </div>
          );
        })}
      </div>

      {/* 拠点×指標マトリクス */}
      <table style={{ marginTop: 18 }}>
        <thead>
          <tr>
            <th>拠点</th>
            <th style={{ textAlign: "right" }}>リスト</th>
            <th style={{ textAlign: "right" }}>アプローチ率</th>
            <th style={{ textAlign: "right" }}>商談化率</th>
            <th style={{ textAlign: "right" }}>内諾率</th>
            <th style={{ textAlign: "right" }}>確定率</th>
            <th style={{ textAlign: "right" }}>確定金額</th>
            <th style={{ textAlign: "right" }}>内諾込み</th>
            <th style={{ textAlign: "right" }}>見込み（加重）</th>
            <th style={{ textAlign: "right" }}>目標比</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((s) => (
            <tr className="row" key={s.base.code}>
              <td><b>{s.base.name}</b></td>
              <td style={{ textAlign: "right" }}>{s.total}件</td>
              <td style={{ textAlign: "right" }}>{rate(s.approached, s.total)}</td>
              <td style={{ textAlign: "right" }}>{rate(s.inTalks, s.total)}</td>
              <td style={{ textAlign: "right" }}>{rate(s.soft, s.total)}</td>
              <td style={{ textAlign: "right" }}>{rate(s.won, s.total)}</td>
              <td style={{ textAlign: "right", color: "var(--green)", fontWeight: 700 }}>{YEN(s.base.money.fixed)}万</td>
              <td style={{ textAlign: "right" }}>{YEN(s.base.money.withSoft)}万</td>
              <td style={{ textAlign: "right" }}>{YEN(s.base.money.weighted)}万</td>
              <td style={{ textAlign: "right" }}>{Math.round(pct(s.base.money.fixed, s.base.goalAmount))}%</td>
            </tr>
          ))}
          <tr style={{ background: "var(--hover)", fontWeight: 700 }}>
            <td>全社</td>
            <td style={{ textAlign: "right" }}>{sum((s) => s.total)}件</td>
            <td style={{ textAlign: "right" }}>{rate(sum((s) => s.approached), sum((s) => s.total))}</td>
            <td style={{ textAlign: "right" }}>{rate(sum((s) => s.inTalks), sum((s) => s.total))}</td>
            <td style={{ textAlign: "right" }}>{rate(sum((s) => s.soft), sum((s) => s.total))}</td>
            <td style={{ textAlign: "right" }}>{rate(sum((s) => s.won), sum((s) => s.total))}</td>
            <td style={{ textAlign: "right", color: "var(--green)" }}>{YEN(fixed)}万</td>
            <td style={{ textAlign: "right" }}>{YEN(withSoft)}万</td>
            <td style={{ textAlign: "right" }}>{YEN(weighted)}万</td>
            <td style={{ textAlign: "right" }}>{goalTotal > 0 ? Math.round((fixed / goalTotal) * 100) : 0}%</td>
          </tr>
        </tbody>
      </table>
      <div className="footnote">
        商談化率＝商談中・検討中・内諾・確定の合計／リスト数。見込み受注（加重）＝各社の金額×ステータス確度（検討中0.5・内諾0.8・確定1.0 等）の合計。
        金額はオーナー候補（金額入力あり）が対象です。数値はすべて顧客リストの入力からリアルタイムに集計されます。
      </div>
    </>
  );
}
