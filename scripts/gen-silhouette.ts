/**
 * 県シルエット SVG パス生成 CLI（実装仕様書 §4.2 / §7）
 * -----------------------------------------------------------------------------
 * dataofjapan/land の GeoJSON から都道府県ポリゴンを簡略化・100x100 正規化して
 * bases.silhouette_path 用のパス文字列を生成する。
 *
 * 使い方:
 *   npx tsx scripts/gen-silhouette.ts 福岡              # パスを標準出力
 *   npx tsx scripts/gen-silhouette.ts 福岡 --sql fukuoka # UPDATE 文を出力
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/gen-silhouette.ts 福岡 --write fukuoka  # DB を直接更新
 */
import { generateSilhouette } from "../src/lib/silhouette";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const [pref, flag, baseCode] = process.argv.slice(2);
  if (!pref) {
    console.error("使い方: npx tsx scripts/gen-silhouette.ts <県名> [--sql <base_code>|--write <base_code>]");
    process.exit(1);
  }
  const path = await generateSilhouette(pref);

  if (flag === "--sql" && baseCode) {
    console.log(`update bases set silhouette_path = '${path}' where code = '${baseCode}';`);
    return;
  }
  if (flag === "--write" && baseCode) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      console.error("--write には NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が必要です。");
      process.exit(1);
    }
    const db = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await db.from("bases").update({ silhouette_path: path }).eq("code", baseCode);
    if (error) {
      console.error("更新エラー:", error.message);
      process.exit(1);
    }
    console.log(`✅ bases.silhouette_path を更新しました（code=${baseCode}）`);
    return;
  }
  console.log(path);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
