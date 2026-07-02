# NEO ACADEMIA — 拠点展開ダッシュボード

サテライト拠点（熊本・長崎・佐賀・大分、以後追加あり）の立ち上げ進捗を、**トリガーイベント（T1〜T8）の成立**を背骨に可視化する社内ダッシュボード。

- デザインの正: `design/NEO_ACADEMIA_拠点展開ダッシュボード_モック.html`
- 仕様の正: 実装仕様書 v1.1（ドメインルール §2 / データモデル §3 / 画面 §4）

## 技術スタック

- **フロント**: Next.js 15 (App Router) + TypeScript + Tailwind CSS（Vercel デプロイ想定）
- **バックエンド/DB**: Supabase (PostgreSQL, Realtime)
- **認証**: なし（社内用）。書き込みは必ず Server Action / Route Handler 経由で `service_role` を使用。anon は RLS で書き込み全面拒否・読み取り＆Realtime のみ
- **記録者の識別**: ログインの代わりに初回アクセスで名前を localStorage 保存し、全更新に `actor_name` 付与

## 2つの動作モード

| モード | 条件 | 挙動 |
|---|---|---|
| **モック** | `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` 未設定 | design モック相当のダミーデータで単体動作。書き込みは楽観的に画面反映のみ（永続化なし）。基準日は 2026-07-02 に固定 |
| **Supabase** | 上記が設定済み | 実データを読み書き。成立記録・インライン編集が永続化され、Realtime で他クライアントに反映 |

どちらのモードも同じ `DashboardData`（`src/lib/assembler.ts`）に正規化して描画する。

## セットアップ

```bash
npm install
cp .env.example .env.local   # Supabase を使う場合は値を設定
npm run dev                  # http://localhost:3000
```

環境変数（`.env.local`）:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # サーバー専用。NEXT_PUBLIC_ を付けない
```

## Supabase 初期化

Supabase SQL Editor で順に実行:

1. `supabase/schema.sql` — 全テーブル・ビュー・トリガー（updated_at / activities 自動生成）・RLS
2. `supabase/seed.sql` — マスタ（triggers 8 / statuses 7 / categories / rel_types / prep_role_defs 5）と 4 拠点（県シルエットSVG込み）

拠点追加は `bases` に 1 行 INSERT（+ `silhouette_path`）するだけ。ボード・KPI・全社目標（有効拠点数 × `goal_amount`）に自動反映される。

### Excel 初期インポート

```bash
SEED_EXCEL_PATH=./NEO_ACADEMIA_拠点展開ターゲットリスト.xlsx npm run seed:excel
```

シート（📍熊本/長崎/佐賀/大分）の 4 セクション（スポンサー候補→オーナー候補 / 協力教育機関→教育機関 / 自治体・メディア / 事務局メンバー候補→事務局）を `stakeholders` へ。期待金額（万円）→ `commit_amount`、ステータス文字列は 7 値バリデーション、空行スキップ。

## ドメインルールの所在

- **加盟金パイプライン3層**（確定 / 内諾込み / 加重見込み）: `v_money_pipeline`（SQL）と `domain.moneyFromStakeholders`（TS, モック用）で同一計算。確度係数は `statuses.confidence` が正
- **90日時計**: `v_base_clock` / `domain.computeClock`。残 30 日以下は赤、超過は「超過◯日」を赤表示（隠さない）
- **停滞アラート**: `v_stale_stakeholders` / `domain.isStale`（進行中 かつ 次回アクション未設定 or 14日超）
- **T3/T7 成立提案**: 準備室5ロール確保・確定合計≥目標 をフロントで検知しバナー表示。**自動成立はせず**、必ず人間が成立日・証拠を入力して確定

## 画面

- **拠点ボード**: 8ステップ凡例帯 / 全社・拠点別 KPI / 拠点比較カード（県シルエット水位・T1〜T8チェーン・加盟金3色バー・燃料4指標・準備室5ドット・90日残・NEXT・停滞バッジ）/ 拠点詳細（3層ゲージ・準備室ロール・NEXT TRIGGER・トリガーログ・成立記録）
- **ステークホルダー**: 全拠点横断テーブル（拠点/カテゴリ/検索フィルタ、ステータス・金額・次回アクションのインライン編集、停滞アラート、CSVエクスポート）
- **関係図マップ**: ドラッグ移動・端子ドラッグで接続（4色）・線クリック削除・拠点切替・配置リセット（Supabase永続化とRealtime共同編集は Phase 2）
- **アクティビティ**: 時系列フィード（is_big は黒塗り、ページング）
- **演出**: トリガー成立でネオン斜線スイープの全画面演出。Supabase モードでは Realtime で他メンバー画面にも発火

## Slack / n8n 連携

`activities` INSERT → Supabase Database Webhook → n8n → Slack。`is_big=true`（トリガー成立）は専用チャンネルへリッチ通知（拠点名・T名・証拠・残日数）。Webhook URL は環境変数で扱い、コードに直書きしない。

## 実装フェーズ

- **Phase 1 (本リポジトリ)**: スキーマ+seed / ボード / 拠点詳細（成立記録）/ ステークホルダーテーブル / 成立演出 / 記録者名UI / Excel seed
- **Phase 2**: マップの Supabase 永続化・Realtime 共同編集 / activities Webhook 実接続 / 他画面同時演出の作り込み
- **Phase 3**: 設定画面（トリガー文言・確度係数・燃料目標）/ 燃料推移ミニチャート / 管理画面からの拠点追加（シルエット生成込み）

## ブランド監査

面塗りは白・黒のみ。ネオン5色（#F0F000/#F03090/#00C0F0/#50F000/#F01010）は線・ドット・黒地上のテキストのみ。トンマナは `src/app/globals.css`（モックCSS移植）に集約。
