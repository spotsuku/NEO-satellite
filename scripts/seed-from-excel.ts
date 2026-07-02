/**
 * Excel 初期インポート（実装仕様書 §6）
 * -----------------------------------------------------------------------------
 * 同梱 Excel「NEO_ACADEMIA_拠点展開ターゲットリスト.xlsx」から stakeholders を投入する。
 *
 * 前提:
 *   - シート名に拠点名（熊本/長崎/佐賀/大分）を含む。
 *   - 各シート内に 4 セクション:
 *       スポンサー候補       → categories = オーナー候補
 *       協力教育機関         → categories = 教育機関
 *       自治体・メディア     → categories = 自治体・メディア
 *       事務局メンバー候補   → categories = 事務局
 *   - 期待金額(万円) → commit_amount、ステータス文字列は 7 値をそのまま。
 *   - 空行はスキップ。実在データ（ジェイリース、APU 等）を正しく取り込む。
 *
 * 実行:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   SEED_EXCEL_PATH=./NEO_ACADEMIA_拠点展開ターゲットリスト.xlsx \
 *   npm run seed:excel
 *
 * マスタ（bases/categories/statuses）は先に supabase/schema.sql + seed.sql を適用しておくこと。
 */
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PATH = process.env.SEED_EXCEL_PATH ?? "./NEO_ACADEMIA_拠点展開ターゲットリスト.xlsx";

const VALID_STATUSES = [
  "未アプローチ",
  "アポ調整中",
  "商談中",
  "検討中",
  "内諾",
  "確定",
  "見送り",
];

const BASE_BY_KEYWORD: Record<string, string> = {
  熊本: "kumamoto",
  長崎: "nagasaki",
  佐賀: "saga",
  大分: "oita",
};

// セクション見出し（部分一致）→ カテゴリ名
const SECTION_TO_CATEGORY: [RegExp, string][] = [
  [/スポンサー|オーナー|出資/, "オーナー候補"],
  [/教育|大学|高校|学校/, "教育機関"],
  [/自治体|メディア|行政|新聞|報道/, "自治体・メディア"],
  [/事務局|運営|メンバー/, "事務局"],
];

interface ParsedRow {
  baseCode: string;
  category: string;
  name: string;
  org: string | null;
  contactName: string | null;
  status: string;
  commitAmount: number | null;
  memo: string | null;
}

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : null;
}

function detectCategory(cell: string): string | null {
  for (const [re, cat] of SECTION_TO_CATEGORY) if (re.test(cell)) return cat;
  return null;
}

function baseCodeFromSheet(sheetName: string): string | null {
  for (const [kw, code] of Object.entries(BASE_BY_KEYWORD)) if (sheetName.includes(kw)) return code;
  return null;
}

/** ヘッダー行の列見出しから列インデックスを推定する。 */
function columnMap(header: string[]): Record<string, number> {
  const find = (re: RegExp) => header.findIndex((h) => re.test(String(h ?? "")));
  return {
    name: find(/名前|企業|機関|団体|名称|候補先/),
    org: find(/組織|会社|所属/),
    contact: find(/担当|窓口|氏名|人物/),
    status: find(/ステータス|状態|進捗/),
    amount: find(/金額|期待|コミット|出資/),
    memo: find(/メモ|備考|補足|次回/),
  };
}

function parseSheet(baseCode: string, rows: string[][]): ParsedRow[] {
  const out: ParsedRow[] = [];
  let category: string | null = null;
  let cols: Record<string, number> | null = null;

  for (const row of rows) {
    const nonEmpty = row.filter((c) => String(c ?? "").trim() !== "");
    if (nonEmpty.length === 0) continue;

    // セクション見出し行（1セルのみ or カテゴリ語を含む短い行）
    if (nonEmpty.length <= 2) {
      const cat = detectCategory(nonEmpty.join(" "));
      if (cat) {
        category = cat;
        cols = null; // 次の行をヘッダーとして読み直す
        continue;
      }
    }

    // ヘッダー行検出
    if (!cols && row.some((c) => /ステータス|状態|名前|企業|機関|名称/.test(String(c ?? "")))) {
      cols = columnMap(row.map((c) => String(c ?? "")));
      continue;
    }

    if (!category) continue;
    const c = cols ?? { name: 0, org: 1, contact: 2, status: 3, amount: 4, memo: 5 };
    const name = String(row[c.name] ?? "").trim();
    if (!name) continue;

    let status = String(row[c.status] ?? "").trim();
    if (!VALID_STATUSES.includes(status)) status = "未アプローチ";

    out.push({
      baseCode,
      category,
      name,
      org: c.org >= 0 ? String(row[c.org] ?? "").trim() || null : null,
      contactName: c.contact >= 0 ? String(row[c.contact] ?? "").trim() || null : null,
      status,
      commitAmount: category === "オーナー候補" && c.amount >= 0 ? toNumberOrNull(row[c.amount]) : null,
      memo: c.memo >= 0 ? String(row[c.memo] ?? "").trim() || null : null,
    });
  }
  return out;
}

async function main() {
  if (!URL || !KEY) {
    console.error("環境変数 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が必要です。");
    process.exit(1);
  }
  const wb = XLSX.read(readFileSync(PATH), { type: "buffer" });
  const parsed: ParsedRow[] = [];
  for (const sheetName of wb.SheetNames) {
    const baseCode = baseCodeFromSheet(sheetName);
    if (!baseCode) continue;
    const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[sheetName], { header: 1, blankrows: false, defval: "" });
    const sheetRows = parseSheet(baseCode, rows as string[][]);
    console.log(`  [${sheetName}] → ${baseCode}: ${sheetRows.length} 件`);
    parsed.push(...sheetRows);
  }
  console.log(`合計 ${parsed.length} 件を取り込みます。`);

  const db = createClient(URL, KEY, { auth: { persistSession: false } });

  // マスタ id 解決
  const { data: bases } = await db.from("bases").select("id,code");
  const { data: cats } = await db.from("categories").select("id,name");
  const { data: sts } = await db.from("statuses").select("id,name");
  const baseId = new Map((bases ?? []).map((b) => [b.code, b.id]));
  const catId = new Map((cats ?? []).map((c) => [c.name, c.id]));
  const stId = new Map((sts ?? []).map((s) => [s.name, s.id]));

  const payload = parsed
    .filter((r) => baseId.has(r.baseCode) && catId.has(r.category) && stId.has(r.status))
    .map((r) => ({
      base_id: baseId.get(r.baseCode),
      category_id: catId.get(r.category),
      status_id: stId.get(r.status),
      name: r.name,
      org: r.org,
      contact_name: r.contactName,
      commit_amount: r.commitAmount,
      memo: r.memo,
      is_sample: false,
      updated_by: "excel-seed",
    }));

  if (payload.length === 0) {
    console.warn("挿入対象が 0 件でした。シート構造を確認してください。");
    return;
  }
  const { error, count } = await db.from("stakeholders").insert(payload, { count: "exact" });
  if (error) {
    console.error("挿入エラー:", error.message);
    process.exit(1);
  }
  console.log(`✅ ${count ?? payload.length} 件を stakeholders に投入しました。`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
