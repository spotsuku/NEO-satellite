"use client";

import { useMemo, useState } from "react";
import type { Stakeholder, StatusDef, BaseView } from "@/lib/types";
import { YEN, isStale } from "@/lib/domain";
import { updateStakeholder } from "@/app/actions";
import type { StatusName } from "@/lib/types";

const ALL = "すべて";

export default function StakeholderTable({
  stakeholders,
  bases,
  categories,
  statuses,
  today,
  recorderName,
}: {
  stakeholders: Stakeholder[];
  bases: BaseView[];
  categories: { name: string; usesAmount: boolean }[];
  statuses: StatusDef[];
  today: string;
  recorderName: string;
}) {
  const [fBase, setFBase] = useState(ALL);
  const [fCat, setFCat] = useState(ALL);
  const [query, setQuery] = useState("");
  // 楽観的更新の上書き（id → 差分）
  const [overrides, setOverrides] = useState<Record<string, Partial<Stakeholder>>>({});

  const baseNames = [ALL, ...bases.map((b) => b.name)];
  const catNames = [ALL, ...categories.map((c) => c.name)];

  const merged: Stakeholder[] = useMemo(
    () =>
      stakeholders.map((s) => {
        const ov = overrides[s.id];
        if (!ov) return s;
        const next = { ...s, ...ov };
        next.isStale = isStale(
          {
            status: next.status,
            nextAction: next.nextAction,
            approachedOn: next.approachedOn,
            lastTouchedOn: next.lastTouchedOn,
          },
          statuses,
          today,
        );
        return next;
      }),
    [stakeholders, overrides, statuses, today],
  );

  const rows = merged.filter(
    (s) =>
      (fBase === ALL || s.baseName === fBase) &&
      (fCat === ALL || s.category === fCat) &&
      (query === "" ||
        s.name.toLowerCase().includes(query.toLowerCase()) ||
        s.contactName.toLowerCase().includes(query.toLowerCase())),
  );

  const statusColor = (name: string) => statuses.find((s) => s.name === name)?.color ?? "var(--gray)";

  function patch(id: string, p: Partial<Stakeholder>) {
    setOverrides((o) => ({ ...o, [id]: { ...o[id], ...p } }));
  }

  async function onStatus(s: Stakeholder, status: StatusName) {
    patch(s.id, { status });
    await updateStakeholder({ id: s.id, status, actorName: recorderName });
  }
  async function onNext(s: Stakeholder, nextAction: string) {
    patch(s.id, { nextAction });
    await updateStakeholder({ id: s.id, nextAction, actorName: recorderName });
  }
  async function onAmount(s: Stakeholder, raw: string) {
    const commitAmount = raw === "" ? null : Number(raw);
    patch(s.id, { commitAmount });
    await updateStakeholder({ id: s.id, commitAmount, actorName: recorderName });
  }

  function exportCsv() {
    const head = ["拠点", "カテゴリ", "名前", "担当者", "ステータス", "金額(万)", "アプローチ日", "次回アクション"];
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = rows.map((s) =>
      [
        s.baseName,
        s.category,
        s.name,
        s.contactName,
        s.status,
        s.commitAmount != null ? String(s.commitAmount) : "",
        s.approachedOn ?? "",
        s.nextAction,
      ]
        .map((v) => esc(String(v)))
        .join(","),
    );
    const csv = "﻿" + [head.map(esc).join(","), ...lines].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "neo-academia-stakeholders.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="filters">
        {baseNames.map((n) => (
          <button key={n} className={n === fBase ? "on" : ""} onClick={() => setFBase(n)}>
            {n}
          </button>
        ))}
      </div>
      <div className="filters">
        {catNames.map((n) => (
          <button key={n} className={n === fCat ? "on" : ""} onClick={() => setFCat(n)}>
            {n}
          </button>
        ))}
      </div>
      <div className="filters" style={{ alignItems: "center" }}>
        <input
          className="inline-input"
          style={{ maxWidth: 260 }}
          placeholder="名前・担当者で検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button onClick={exportCsv} style={{ marginLeft: "auto" }}>
          CSVエクスポート
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th>拠点</th>
            <th>カテゴリ</th>
            <th>名前</th>
            <th>担当者</th>
            <th>ステータス</th>
            <th style={{ textAlign: "right" }}>金額(万)</th>
            <th>アプローチ日</th>
            <th>次回アクション</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr className="row" key={s.id}>
              <td>{s.baseName}</td>
              <td className="dim">{s.category}</td>
              <td>
                <b>{s.name}</b>
                {s.isSample && <span className="samp">サンプル</span>}
              </td>
              <td className="dim">{s.contactName}</td>
              <td>
                <span
                  className={`stat ${s.status !== "未アプローチ" ? "filled" : ""}`}
                  style={{ ["--dc" as string]: statusColor(s.status) }}
                >
                  <select
                    value={s.status}
                    onChange={(e) => onStatus(s, e.target.value as StatusName)}
                    style={{
                      border: "none",
                      background: "none",
                      font: "inherit",
                      color: "var(--ink)",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {statuses.map((st) => (
                      <option key={st.name} value={st.name}>
                        {st.name}
                      </option>
                    ))}
                  </select>
                </span>
              </td>
              <td className="amtcell" style={{ color: s.commitAmount ? "var(--ink)" : "var(--gray)" }}>
                {s.usesAmount ? (
                  <input
                    className="inline-input"
                    style={{ textAlign: "right", maxWidth: 90 }}
                    type="number"
                    value={s.commitAmount ?? ""}
                    placeholder="—"
                    onChange={(e) => onAmount(s, e.target.value)}
                  />
                ) : (
                  "—"
                )}
              </td>
              <td className="dim">{s.approachedOn ?? "—"}</td>
              <td>
                <input
                  className="inline-input"
                  value={s.nextAction}
                  placeholder="次回アクションを入力"
                  onChange={(e) => patch(s.id, { nextAction: e.target.value })}
                  onBlur={(e) => onNext(s, e.target.value)}
                />
                {s.isStale && (
                  <div className="alert">
                    ⚠ {!s.nextAction ? "次回アクション未設定" : "14日以上停滞"}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="footnote">
        「次回アクション」が未設定、またはアプローチ日から14日以上動きがない先は赤で警告表示します。金額列はオーナー候補のコミット希望額です。
        ステータス・金額・次回アクションはその場で編集できます。
      </div>
    </>
  );
}
