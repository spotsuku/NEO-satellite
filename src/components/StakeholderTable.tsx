"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Stakeholder, StatusDef, BaseView } from "@/lib/types";
import { isStale } from "@/lib/domain";
import {
  createStakeholder,
  createStakeholdersBulk,
  deleteStakeholder,
  updateStakeholder,
  type BulkStakeholderRow,
} from "@/app/actions";
import type { StatusName } from "@/lib/types";

const ALL = "すべて";

function AddModal({
  bases,
  categories,
  statuses,
  recorderName,
  onClose,
  onAdded,
}: {
  bases: BaseView[];
  categories: { name: string; usesAmount: boolean }[];
  statuses: StatusDef[];
  recorderName: string;
  onClose: () => void;
  onAdded: (s: Stakeholder) => void;
}) {
  const [baseCode, setBaseCode] = useState(bases[0]?.code ?? "");
  const [category, setCategory] = useState(categories[0]?.name ?? "オーナー候補");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<StatusName>("未アプローチ");
  const [amount, setAmount] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usesAmount = categories.find((c) => c.name === category)?.usesAmount ?? false;

  async function save() {
    setError(null);
    if (!name.trim()) {
      setError("名前は必須です");
      return;
    }
    setBusy(true);
    const commitAmount = usesAmount && amount !== "" ? Number(amount) : null;
    const res = await createStakeholder({
      baseCode,
      category,
      name: name.trim(),
      contactName: contact,
      title,
      status,
      commitAmount,
      nextAction,
      actorName: recorderName,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "保存に失敗しました");
      return;
    }
    const base = bases.find((b) => b.code === baseCode);
    onAdded({
      id: `local-${Date.now()}`,
      baseName: base?.name ?? baseCode,
      baseCode,
      category,
      usesAmount,
      name: name.trim(),
      contactName: contact || "—",
      title,
      status,
      commitAmount,
      approachedOn: new Date().toISOString().slice(0, 10),
      lastTouchedOn: new Date().toISOString().slice(0, 10),
      nextAction,
      nextActionDue: null,
      isSample: false,
      isStale: false,
    });
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mhd">
          <div>
            <div className="mk">NEW STAKEHOLDER</div>
            <h3>ステークホルダーを追加</h3>
          </div>
          <button className="x" onClick={onClose} aria-label="閉じる">×</button>
        </div>
        <div className="mbd">
          <div className="mrow2">
            <div>
              <label>拠点</label>
              <select value={baseCode} onChange={(e) => setBaseCode(e.target.value)}>
                {bases.map((b) => (
                  <option key={b.code} value={b.code}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label>カテゴリ</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <label>所属（企業名/機関名。個人のみの場合は氏名）<span className="req">*</span></label>
          <input type="text" value={name} autoFocus onChange={(e) => setName(e.target.value)} />
          <div className="mrow2">
            <div>
              <label>氏名</label>
              <input type="text" value={contact} onChange={(e) => setContact(e.target.value)} />
            </div>
            <div>
              <label>役職</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
          </div>
          <div className="mrow2">
            <div>
              <label>ステータス</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as StatusName)}>
                {statuses.map((st) => (
                  <option key={st.name} value={st.name}>{st.name}</option>
                ))}
              </select>
            </div>
            {usesAmount && (
              <div>
                <label>期待金額（万円）</label>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
            )}
          </div>
          <label>次回アクション</label>
          <input type="text" value={nextAction} onChange={(e) => setNextAction(e.target.value)} />
          {error && <div className="err">{error}</div>}
          <div className="mfoot">
            <button className="save" onClick={save} disabled={busy}>
              {busy ? "保存中…" : "追加する"}
            </button>
            <button className="cancel" onClick={onClose}>キャンセル</button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const [showAdd, setShowAdd] = useState(false);
  // 楽観的更新の上書き（id → 差分）と追加行（Supabase モードでは refresh 後に本データへ）
  const [overrides, setOverrides] = useState<Record<string, Partial<Stakeholder>>>({});
  const [added, setAdded] = useState<Stakeholder[]>([]);
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [pasteMsg, setPasteMsg] = useState<string | null>(null);

  // スプレッドシート式の追加行（拠点/カテゴリ/ステータスは連続入力向けに保持）
  const [draft, setDraft] = useState({
    baseCode: bases[0]?.code ?? "",
    category: categories[0]?.name ?? "オーナー候補",
    name: "",
    contact: "",
    title: "",
    status: "未アプローチ" as StatusName,
    amount: "",
    nextAction: "",
  });
  const draftNameRef = useRef<HTMLInputElement>(null);

  // Realtime / refresh で本データが届いたら、楽観追加行の重複を落とす
  useEffect(() => {
    setAdded((prev) =>
      prev.filter((a) => !stakeholders.some((s) => s.name === a.name && s.baseCode === a.baseCode)),
    );
  }, [stakeholders]);

  // サーバーに反映済みの楽観上書きは破棄する。
  // 残したままだと他メンバーの更新（Realtime）が上書きで隠れてしまう。
  useEffect(() => {
    setOverrides((prev) => {
      const next: Record<string, Partial<Stakeholder>> = {};
      for (const [id, ov] of Object.entries(prev)) {
        const server = stakeholders.find((s) => s.id === id);
        if (!server) continue;
        const pending: Partial<Stakeholder> = {};
        for (const [k, v] of Object.entries(ov)) {
          if (server[k as keyof Stakeholder] !== v) (pending as Record<string, unknown>)[k] = v;
        }
        if (Object.keys(pending).length) next[id] = pending;
      }
      return next;
    });
  }, [stakeholders]);

  const baseNames = [ALL, ...bases.map((b) => b.name)];
  const catNames = [ALL, ...categories.map((c) => c.name)];

  const merged: Stakeholder[] = useMemo(
    () =>
      [...added, ...stakeholders].map((s) => {
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
    [stakeholders, added, overrides, statuses, today],
  );

  const rows = merged.filter(
    (s) =>
      !deleted.has(s.id) &&
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
  async function onName(s: Stakeholder, name: string) {
    if (!name.trim() || name === s.name) return;
    await updateStakeholder({ id: s.id, name, actorName: recorderName });
  }
  async function onContact(s: Stakeholder, contactName: string) {
    if (contactName === s.contactName) return;
    await updateStakeholder({ id: s.id, contactName, actorName: recorderName });
  }
  async function onTitle(s: Stakeholder, title: string) {
    if (title === s.title) return;
    await updateStakeholder({ id: s.id, title, actorName: recorderName });
  }
  async function onDelete(s: Stakeholder) {
    if (!window.confirm(`「${s.name}」を削除しますか？\n（マップ上のノード・準備室の紐付けも解除されます）`)) return;
    setDeleted((p) => new Set(p).add(s.id));
    const res = await deleteStakeholder({ id: s.id, actorName: recorderName });
    if (!res.ok) {
      window.alert(res.error ?? "削除に失敗しました");
      setDeleted((p) => {
        const n = new Set(p);
        n.delete(s.id);
        return n;
      });
    }
  }

  // 拠点フィルタを切り替えたら追加行の拠点も追従（連続入力しやすく）
  useEffect(() => {
    const b = bases.find((x) => x.name === fBase);
    if (b) setDraft((d) => ({ ...d, baseCode: b.code }));
  }, [fBase, bases]);

  function localRow(r: BulkStakeholderRow, i: number): Stakeholder {
    const base = bases.find((b) => b.code === r.baseCode);
    const today = new Date().toISOString().slice(0, 10);
    return {
      id: `local-${Date.now()}-${i}`,
      baseName: base?.name ?? r.baseCode,
      baseCode: r.baseCode,
      category: r.category,
      usesAmount: categories.find((c) => c.name === r.category)?.usesAmount ?? false,
      name: r.name,
      contactName: r.contactName || "—",
      title: r.title ?? "",
      status: r.status,
      commitAmount: r.commitAmount ?? null,
      approachedOn: today,
      lastTouchedOn: today,
      nextAction: r.nextAction ?? "",
      nextActionDue: null,
      isSample: false,
      isStale: false,
    };
  }

  // IME（日本語入力）の変換確定 Enter では追加しない。
  // isComposing / keyCode 229（Safari 等）の間は無視する。
  function onDraftEnter(e: React.KeyboardEvent) {
    if (e.key !== "Enter") return;
    if (e.nativeEvent.isComposing || (e.nativeEvent as KeyboardEvent).keyCode === 229) return;
    commitDraft();
  }

  // 追加行の確定（Enter または ＋ボタン）
  async function commitDraft() {
    const name = draft.name.trim();
    if (!name) return;
    const row: BulkStakeholderRow = {
      baseCode: draft.baseCode,
      category: draft.category,
      name,
      contactName: draft.contact,
      title: draft.title,
      status: draft.status,
      commitAmount: draft.amount !== "" ? Number(draft.amount) : null,
      nextAction: draft.nextAction,
    };
    setAdded((prev) => [localRow(row, 0), ...prev]);
    setDraft((d) => ({ ...d, name: "", contact: "", title: "", amount: "", nextAction: "" }));
    draftNameRef.current?.focus();
    const res = await createStakeholder({
      baseCode: row.baseCode,
      category: row.category,
      name: row.name,
      contactName: row.contactName,
      status: row.status,
      commitAmount: row.commitAmount,
      nextAction: row.nextAction,
      actorName: recorderName,
    });
    if (!res.ok) window.alert(res.error ?? "追加に失敗しました");
  }

  // スプレッドシート貼り付け（TSV）→ 一括登録
  // 列の解釈: [拠点] [カテゴリ] 名前 担当者 ステータス 金額 次回アクション
  // 拠点・カテゴリ列が無い場合は追加行の選択値を使用。ヘッダー行は自動スキップ。
  async function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\t") && !text.includes("\n")) return; // 通常の単セル貼り付けはそのまま
    e.preventDefault();
    const baseByName = new Map(bases.map((b) => [b.name, b.code]));
    const catSet = new Set(categories.map((c) => c.name));
    const stSet = new Set<string>(statuses.map((s) => s.name));
    const rows: BulkStakeholderRow[] = [];
    for (const line of text.split(/\r?\n/)) {
      const c = line.split("\t").map((x) => x.trim());
      if (c.every((x) => !x)) continue;
      if (/名前|ステータス|カテゴリ/.test(c[0] + (c[1] ?? "") + (c[2] ?? ""))) continue; // ヘッダー行
      let i = 0;
      let baseCode = draft.baseCode;
      let category = draft.category;
      if (baseByName.has(c[0])) {
        baseCode = baseByName.get(c[0])!;
        i = 1;
      }
      if (catSet.has(c[i])) {
        category = c[i];
        i += 1;
      }
      const name = c[i] ?? "";
      if (!name) continue;
      const contactName = c[i + 1] ?? "";
      // 役職列は省略可: 次のセルがステータス名なら役職なしとみなす
      let k = i + 2;
      let title = "";
      if (c[k] !== undefined && !stSet.has(c[k])) {
        title = c[k] ?? "";
        k += 1;
      }
      const status = (stSet.has(c[k]) ? c[k] : "未アプローチ") as StatusName;
      if (stSet.has(c[k])) k += 1;
      const amountRaw = (c[k] ?? "").replace(/[^\d]/g, "");
      const commitAmount = amountRaw ? Number(amountRaw) : null;
      const nextAction = c[k + 1] ?? "";
      rows.push({ baseCode, category, name, contactName, title, status, commitAmount, nextAction });
    }
    if (rows.length === 0) return;
    setAdded((prev) => [...rows.map(localRow), ...prev]);
    setPasteMsg(`${rows.length}件を貼り付け登録中…`);
    const res = await createStakeholdersBulk({ rows, actorName: recorderName });
    setPasteMsg(
      res.ok
        ? `✅ ${res.inserted ?? rows.length}件を登録しました${res.demo ? "（モック: 保存されません）" : ""}`
        : `❌ ${res.error}`,
    );
    setTimeout(() => setPasteMsg(null), 4000);
  }

  // 表示中の行をスプレッドシート形式（TSV）でコピー
  async function copyTsv() {
    const head = ["拠点", "カテゴリ", "所属", "氏名", "役職", "ステータス", "金額(万)", "アプローチ日", "次回アクション"];
    const lines = rows.map((s) =>
      [
        s.baseName,
        s.category,
        s.name,
        s.contactName,
        s.title,
        s.status,
        s.commitAmount != null ? String(s.commitAmount) : "",
        s.approachedOn ?? "",
        s.nextAction,
      ].join("\t"),
    );
    await navigator.clipboard.writeText([head.join("\t"), ...lines].join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function exportCsv() {
    const head = ["拠点", "カテゴリ", "所属", "氏名", "役職", "ステータス", "金額(万)", "アプローチ日", "次回アクション"];
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = rows.map((s) =>
      [
        s.baseName,
        s.category,
        s.name,
        s.contactName,
        s.title,
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
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--gray)", alignSelf: "center" }}>
          {pasteMsg ?? "下の追加行に入力 ／ Excel・スプレッドシートから貼り付けで一括登録"}
        </span>
        <button onClick={copyTsv}>{copied ? "✓ コピーしました" : "表をコピー"}</button>
        <button onClick={() => setShowAdd(true)}>フォームで追加</button>
        <button onClick={exportCsv}>CSVエクスポート</button>
      </div>

      <table>
        <thead>
          <tr>
            <th>拠点</th>
            <th>カテゴリ</th>
            <th>所属</th>
            <th>氏名</th>
            <th>役職</th>
            <th>ステータス</th>
            <th style={{ textAlign: "right" }}>金額(万)</th>
            <th>アプローチ日</th>
            <th>次回アクション</th>
            <th style={{ width: 40 }} />
          </tr>
        </thead>
        <tbody>
          {/* ===== スプレッドシート式 追加行 ===== */}
          <tr style={{ background: "var(--hover)" }}>
            <td>
              <select
                className="inline-input"
                value={draft.baseCode}
                onChange={(e) => setDraft((d) => ({ ...d, baseCode: e.target.value }))}
              >
                {bases.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                  </option>
                ))}
              </select>
            </td>
            <td>
              <select
                className="inline-input"
                value={draft.category}
                onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
              >
                {categories.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </td>
            <td>
              <input
                ref={draftNameRef}
                className="inline-input"
                style={{ fontWeight: 700, minWidth: 140 }}
                placeholder="＋ 所属（企業/機関/個人名）を入力 ／ 貼り付けで一括"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                onKeyDown={onDraftEnter}
                onPaste={handlePaste}
              />
            </td>
            <td>
              <input
                className="inline-input"
                placeholder="氏名"
                value={draft.contact}
                onChange={(e) => setDraft((d) => ({ ...d, contact: e.target.value }))}
                onKeyDown={onDraftEnter}
                onPaste={handlePaste}
              />
            </td>
            <td>
              <input
                className="inline-input"
                placeholder="役職"
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                onKeyDown={onDraftEnter}
                onPaste={handlePaste}
              />
            </td>
            <td>
              <select
                className="inline-input"
                value={draft.status}
                onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as StatusName }))}
              >
                {statuses.map((st) => (
                  <option key={st.name} value={st.name}>
                    {st.name}
                  </option>
                ))}
              </select>
            </td>
            <td className="amtcell">
              {(categories.find((c) => c.name === draft.category)?.usesAmount ?? false) ? (
                <input
                  className="inline-input"
                  style={{ textAlign: "right", maxWidth: 90 }}
                  type="number"
                  placeholder="万円"
                  value={draft.amount}
                  onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
                  onKeyDown={onDraftEnter}
                />
              ) : (
                <span className="dim">—</span>
              )}
            </td>
            <td className="dim">今日</td>
            <td>
              <input
                className="inline-input"
                placeholder="次回アクション"
                value={draft.nextAction}
                onChange={(e) => setDraft((d) => ({ ...d, nextAction: e.target.value }))}
                onKeyDown={onDraftEnter}
              />
            </td>
            <td>
              <button
                onClick={commitDraft}
                disabled={!draft.name.trim()}
                title="この行を追加（Enterでも追加）"
                style={{
                  background: draft.name.trim() ? "var(--ink)" : "var(--lgray)",
                  color: "#fff",
                  border: "none",
                  width: 26,
                  height: 26,
                  cursor: draft.name.trim() ? "pointer" : "not-allowed",
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                ＋
              </button>
            </td>
          </tr>

          {rows.map((s) => (
            <tr className="row" key={s.id}>
              <td>{s.baseName}</td>
              <td className="dim">{s.category}</td>
              <td>
                <input
                  key={`n-${s.id}-${s.name}`}
                  className="inline-input"
                  style={{ fontWeight: 700, minWidth: 140 }}
                  defaultValue={s.name}
                  onBlur={(e) => {
                    patch(s.id, { name: e.target.value });
                    onName(s, e.target.value);
                  }}
                />
                {s.isSample && <span className="samp">サンプル</span>}
              </td>
              <td className="dim">
                <input
                  key={`c-${s.id}-${s.contactName}`}
                  className="inline-input"
                  defaultValue={s.contactName === "—" ? "" : s.contactName}
                  placeholder="—"
                  onBlur={(e) => {
                    patch(s.id, { contactName: e.target.value || "—" });
                    onContact(s, e.target.value);
                  }}
                />
              </td>
              <td className="dim">
                <input
                  key={`t-${s.id}-${s.title}`}
                  className="inline-input"
                  defaultValue={s.title}
                  placeholder="—"
                  onBlur={(e) => {
                    patch(s.id, { title: e.target.value });
                    onTitle(s, e.target.value);
                  }}
                />
              </td>
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
              <td>
                <button
                  onClick={() => onDelete(s)}
                  title="このステークホルダーを削除"
                  style={{
                    background: "none",
                    border: "1px solid var(--line)",
                    color: "var(--gray)",
                    width: 26,
                    height: 26,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--red)";
                    e.currentTarget.style.color = "var(--red)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--line)";
                    e.currentTarget.style.color = "var(--gray)";
                  }}
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="footnote">
        「次回アクション」が未設定、またはアプローチ日から14日以上動きがない先は赤で警告表示します。金額列はオーナー候補のコミット希望額です。
        ステータス・金額・次回アクションはその場で編集できます。
      </div>

      {showAdd && (
        <AddModal
          bases={bases}
          categories={categories}
          statuses={statuses}
          recorderName={recorderName}
          onClose={() => setShowAdd(false)}
          onAdded={(s) => {
            setAdded((prev) => [s, ...prev]);
            setShowAdd(false);
          }}
        />
      )}
    </>
  );
}
