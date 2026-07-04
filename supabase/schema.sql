-- =============================================================================
-- NEO ACADEMIA — 拠点展開ダッシュボード / スキーマ定義
-- 実装仕様書 v1.1 §3 準拠
--
-- 設計方針:
--  - 拠点・トリガー・ステータス・カテゴリ・関係種別はすべてマスタテーブル。
--    拠点追加やステップ改定はデータ投入のみで完結（コード変更・デプロイ不要）。
--  - 確度係数はステータスマスタに持たせ、金額パイプライン計算を一元化。
--  - 集計はビューに寄せ、フロントは計算しない。
--  - 全テーブルに created_at、更新のあるテーブルに updated_at（トリガーで自動更新）。
--
-- 実行順: このファイル → supabase/seed.sql（マスタ・拠点シード）
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 共通: updated_at 自動更新トリガー関数
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================== マスタ ===========================
create table if not exists bases (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,                   -- 'oita' 等。URL・ログで使用
  name text not null,                          -- '大分'
  name_en text not null,                       -- 'OITA'
  region text,                                 -- '九州' 等（将来の地方別集計用）
  goal_amount integer not null default 3000,   -- 加盟金目標（万円）
  deadline_days integer not null default 90,   -- T1 からの期限日数
  silhouette_path text,                        -- 県シルエット SVG パス（100x100 正規化）
  accent_color text,                           -- KPI カード上端の色（任意）
  sort integer not null default 100,
  is_active boolean not null default true,     -- 撤退拠点は非表示化（削除しない）
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- 拠点追加 = このテーブルに INSERT するだけ。silhouette_path は
-- scripts/gen-silhouette.ts（dataofjapan/land GeoJSON→簡略化→正規化）で生成して投入。

create table if not exists triggers (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,                   -- 'T1'〜'T8'
  name text not null,                          -- '地域の紹介役合意'
  description text,                            -- 凡例帯の一言（誰がどう変わるか）
  criteria text,                               -- 成立条件（何が起きたら成立と記録するか）
  is_clock_start boolean not null default false, -- T1: 成立で90日時計起動
  auto_rule text,                              -- 'prep_complete' | 'goal_reached' | null
  sort integer not null
);
-- 既存DBへの追補（冪等）
alter table triggers add column if not exists criteria text;
alter table triggers add column if not exists checklist jsonb; -- 成立条件チェックリスト（短い達成項目の配列）

create table if not exists statuses (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,                   -- '未アプローチ'〜'見送り'
  confidence numeric not null default 0,       -- 金額確度: 商談中0.3, 検討中0.5, 内諾0.8, 確定1.0
  is_active_deal boolean not null default false, -- 停滞アラート対象（アポ調整中/商談中/検討中/内諾）
  is_terminal boolean not null default false,  -- 確定/見送り
  color text not null,                         -- 表示色 HEX
  sort integer not null
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,                   -- 'オーナー候補','教育機関',...
  uses_amount boolean not null default false,  -- オーナー候補のみ true
  default_zone_x numeric,
  default_zone_y numeric,                      -- マップ初期配置ゾーン（0-1）
  sort integer not null
);

create table if not exists prep_role_defs (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,                   -- 5ロール。将来の増減に備えマスタ化
  sort integer not null
);

create table if not exists rel_types (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,                   -- '紹介','協力','出資検討','連携'
  color text not null,
  sort integer not null
);

create table if not exists app_settings (
  key text primary key,                        -- 'fuel_target_interest'=10 等の全体設定
  value jsonb not null,
  description text,
  updated_at timestamptz default now()
);

-- =========================== トランザクション ===========================
create table if not exists stakeholders (
  id uuid primary key default gen_random_uuid(),
  base_id uuid not null references bases(id),
  category_id uuid not null references categories(id),
  status_id uuid not null references statuses(id),
  name text not null,                          -- 企業名/機関名/氏名
  org text, contact_name text, title text, department text,
  phone text, email text,
  commit_amount integer,                       -- 万円。categories.uses_amount=true のみ UI 表示
  approached_on date,
  last_touched_on date,                        -- 最終接触日（停滞判定に使用）
  next_action text,
  next_action_due date,
  referrer text, link text, memo text,
  is_sample boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  updated_by text                              -- actor_name
);
create index if not exists idx_stakeholders_base on stakeholders(base_id);
create index if not exists idx_stakeholders_status on stakeholders(status_id);

create table if not exists trigger_events (
  id uuid primary key default gen_random_uuid(),
  base_id uuid not null references bases(id),
  trigger_id uuid not null references triggers(id),
  achieved_on date not null,
  participants text,
  evidence text not null,                      -- 成立の質的証拠（必須）
  recorded_by text not null,
  created_at timestamptz default now(),
  unique (base_id, trigger_id)                 -- 同一拠点で同一トリガーは一度だけ
);

create table if not exists prep_assignments (
  id uuid primary key default gen_random_uuid(),
  base_id uuid not null references bases(id),
  role_id uuid not null references prep_role_defs(id),
  stakeholder_id uuid references stakeholders(id),
  state text not null default '未' check (state in ('未','検討中','確保')),
  updated_at timestamptz default now(),
  updated_by text,
  unique (base_id, role_id)
);

create table if not exists fuel_metrics (
  id uuid primary key default gen_random_uuid(),
  base_id uuid not null references bases(id),
  metric text not null check (metric in ('interest','loi','students','partner_univ')),
  value integer not null,
  noted_on date not null default current_date,
  recorded_by text,
  created_at timestamptz default now()
);
create index if not exists idx_fuel_base_metric on fuel_metrics(base_id, metric, noted_on desc);
-- 追記型。最新値表示はビュー、推移チャートもこのテーブルから。

create table if not exists fuel_targets (
  base_id uuid not null references bases(id),
  metric text not null,
  target integer not null,
  primary key (base_id, metric)
);
-- 未設定時は app_settings の全体デフォルトを使用。

create table if not exists map_nodes (
  id uuid primary key default gen_random_uuid(),
  base_id uuid not null references bases(id),
  stakeholder_id uuid references stakeholders(id),
  kind text not null default 'stakeholder' check (kind in ('hub','stakeholder','free')),
  label text,                                  -- kind <> 'stakeholder' 用
  x numeric not null, y numeric not null,      -- キャンバス比率座標（0-1）で保存し解像度非依存に
  updated_at timestamptz default now(),
  updated_by text,
  unique (base_id, stakeholder_id)
);

create table if not exists map_edges (
  id uuid primary key default gen_random_uuid(),
  base_id uuid not null references bases(id),
  from_node uuid not null references map_nodes(id) on delete cascade,
  to_node uuid not null references map_nodes(id) on delete cascade,
  rel_type_id uuid not null references rel_types(id),
  created_by text,
  created_at timestamptz default now(),
  unique (base_id, from_node, to_node)
);

-- 成立条件チェックリストの進捗（拠点×トリガー×項目。全員で共有・Realtime同期）
create table if not exists trigger_checklist_progress (
  id uuid primary key default gen_random_uuid(),
  base_id uuid not null references bases(id),
  trigger_id uuid not null references triggers(id),
  item_index integer not null,
  checked boolean not null default false,
  updated_at timestamptz default now(),
  updated_by text,
  unique (base_id, trigger_id, item_index)
);

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  base_id uuid references bases(id),
  kind text not null check (kind in ('trigger','status','amount','fuel','prep','map','system')),
  title text not null,
  body text,
  is_big boolean not null default false,
  actor_name text,
  created_at timestamptz default now()
);
create index if not exists idx_activities_created on activities(created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at トリガー
-- ---------------------------------------------------------------------------
drop trigger if exists trg_bases_updated on bases;
create trigger trg_bases_updated before update on bases
  for each row execute function set_updated_at();
drop trigger if exists trg_stakeholders_updated on stakeholders;
create trigger trg_stakeholders_updated before update on stakeholders
  for each row execute function set_updated_at();
drop trigger if exists trg_prep_updated on prep_assignments;
create trigger trg_prep_updated before update on prep_assignments
  for each row execute function set_updated_at();
drop trigger if exists trg_mapnodes_updated on map_nodes;
create trigger trg_mapnodes_updated before update on map_nodes
  for each row execute function set_updated_at();

-- =========================== ビュー（集計の正）===========================

-- 拠点の時計: T1 成立日と期限・残日数
create or replace view v_base_clock as
select b.id as base_id,
       te.achieved_on as clock_start,
       te.achieved_on + b.deadline_days as t7_due,
       (te.achieved_on + b.deadline_days) - current_date as days_left
from bases b
left join trigger_events te
  on te.base_id = b.id
 and te.trigger_id = (select id from triggers where is_clock_start limit 1);

-- 加盟金パイプライン3層（確定 / 内諾込み / 見込み込み）
create or replace view v_money_pipeline as
select s.base_id,
  coalesce(sum(s.commit_amount) filter (where st.name = '確定'), 0)                      as fixed,
  coalesce(sum(s.commit_amount) filter (where st.name in ('確定','内諾')), 0)            as with_soft,
  coalesce(sum(coalesce(s.commit_amount, 0) * st.confidence)
      filter (where st.is_active_deal or st.name = '確定'), 0)                           as weighted
from stakeholders s
join statuses st on st.id = s.status_id
join categories c on c.id = s.category_id and c.uses_amount
group by s.base_id;

-- 拠点進捗サマリー（ボード用に1クエリで取れる形）
create or replace view v_base_progress as
select b.id as base_id, b.code, b.name, b.goal_amount,
  (select count(*) from trigger_events te where te.base_id = b.id)                       as triggers_done,
  (select count(*) from triggers)                                                        as triggers_total,
  (select count(*) from prep_assignments pa where pa.base_id = b.id and pa.state = '確保') as prep_secured,
  (select count(*) from prep_role_defs)                                                  as prep_total
from bases b where b.is_active;

-- 停滞ステークホルダー（進行中 かつ 次回アクション未設定 or 14日超）
create or replace view v_stale_stakeholders as
select s.*, b.name as base_name
from stakeholders s
join statuses st on st.id = s.status_id and st.is_active_deal
join bases b on b.id = s.base_id
where s.next_action is null or s.next_action = ''
   or coalesce(s.last_touched_on, s.approached_on, s.created_at::date)
      < current_date - interval '14 days';

-- =========================== activities 自動生成トリガー ===========================
-- trigger_events / stakeholders(status・amount変更) / prep_assignments / map_edges
-- の差分から本文を組み立て、activities に記録する。

-- トリガー成立 → is_big=true
create or replace function log_trigger_event()
returns trigger language plpgsql as $$
declare
  t_code text; t_name text; b_name text; days_left integer;
begin
  select code, name into t_code, t_name from triggers where id = new.trigger_id;
  select name into b_name from bases where id = new.base_id;
  select ( (select achieved_on from trigger_events te2
              where te2.base_id = new.base_id
                and te2.trigger_id = (select id from triggers where is_clock_start limit 1))
           + (select deadline_days from bases where id = new.base_id) ) - current_date
    into days_left;
  insert into activities(base_id, kind, title, body, is_big, actor_name)
  values (new.base_id, 'trigger',
          format('%s %s 成立', t_code, t_name),
          coalesce(new.evidence, ''), true, new.recorded_by);
  return new;
end;
$$;
drop trigger if exists trg_log_trigger_event on trigger_events;
create trigger trg_log_trigger_event after insert on trigger_events
  for each row execute function log_trigger_event();

-- ステータス前進・金額変更
create or replace function log_stakeholder_change()
returns trigger language plpgsql as $$
declare
  old_st text; new_st text; is_advance boolean := false;
begin
  select name into new_st from statuses where id = new.status_id;
  if tg_op = 'INSERT' then
    insert into activities(base_id, kind, title, body, is_big, actor_name)
    values (new.base_id, 'status', format('%s を登録（%s）', new.name, new_st), null, false, new.updated_by);
    return new;
  end if;
  select name into old_st from statuses where id = old.status_id;
  if new.status_id is distinct from old.status_id then
    is_advance := new_st in ('内諾','確定');
    insert into activities(base_id, kind, title, body, is_big, actor_name)
    values (new.base_id, 'status',
            format('%s：%s → %s', new.name, old_st, new_st), null, is_advance, new.updated_by);
  end if;
  if new.commit_amount is distinct from old.commit_amount then
    insert into activities(base_id, kind, title, body, is_big, actor_name)
    values (new.base_id, 'amount',
            format('%s：コミット希望額 %s万円', new.name, coalesce(new.commit_amount, 0)),
            null, false, new.updated_by);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_log_stakeholder on stakeholders;
create trigger trg_log_stakeholder after insert or update on stakeholders
  for each row execute function log_stakeholder_change();

-- 準備室ロール状態変更
create or replace function log_prep_change()
returns trigger language plpgsql as $$
declare role_name text; b_name text;
begin
  if tg_op = 'UPDATE' and new.state is not distinct from old.state then
    return new;
  end if;
  select name into role_name from prep_role_defs where id = new.role_id;
  insert into activities(base_id, kind, title, body, is_big, actor_name)
  values (new.base_id, 'prep',
          format('準備室ロール「%s」→ %s', role_name, new.state), null, false, new.updated_by);
  return new;
end;
$$;
drop trigger if exists trg_log_prep on prep_assignments;
create trigger trg_log_prep after insert or update on prep_assignments
  for each row execute function log_prep_change();

-- 燃料記録
create or replace function log_fuel_change()
returns trigger language plpgsql as $$
declare label text;
begin
  label := case new.metric
    when 'interest' then '興味人材'
    when 'loi' then '会員LOI'
    when 'students' then '学生登録'
    when 'partner_univ' then 'パートナー校'
    else new.metric end;
  insert into activities(base_id, kind, title, body, is_big, actor_name)
  values (new.base_id, 'fuel', format('%s → %s', label, new.value), null, false, new.recorded_by);
  return new;
end;
$$;
drop trigger if exists trg_log_fuel on fuel_metrics;
create trigger trg_log_fuel after insert on fuel_metrics
  for each row execute function log_fuel_change();

-- 拠点追加時に準備室5ロールの割当行を自動作成
-- （bases に1行 INSERT するだけでボード・準備室表示が成立する）
create or replace function init_prep_assignments()
returns trigger language plpgsql as $$
begin
  insert into prep_assignments(base_id, role_id, state)
  select new.id, r.id, '未' from prep_role_defs r
  on conflict (base_id, role_id) do nothing;
  return new;
end;
$$;
drop trigger if exists trg_init_prep on bases;
create trigger trg_init_prep after insert on bases
  for each row execute function init_prep_assignments();

-- =========================== RLS ===========================
-- anon の書き込みは全面拒否、select は Realtime / 読み取り用に許可（社内利用）。
-- 書き込みは Next.js の Route Handler / Server Action が service_role で行う。
-- service_role は RLS をバイパスするため、明示的な write ポリシーは付与しない。
do $$
declare t text;
begin
  foreach t in array array[
    'bases','triggers','statuses','categories','prep_role_defs','rel_types','app_settings',
    'stakeholders','trigger_events','prep_assignments','fuel_metrics','fuel_targets',
    'map_nodes','map_edges','activities','trigger_checklist_progress'
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %I on %I;', t || '_anon_select', t);
    execute format(
      'create policy %I on %I for select to anon, authenticated using (true);',
      t || '_anon_select', t);
  end loop;
end $$;

-- Realtime 購読対象（読み取り専用）
-- Supabase ダッシュボード or 下記で publication に追加。
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table activities';
    execute 'alter publication supabase_realtime add table trigger_events';
    execute 'alter publication supabase_realtime add table map_nodes';
    execute 'alter publication supabase_realtime add table map_edges';
    execute 'alter publication supabase_realtime add table stakeholders';
    execute 'alter publication supabase_realtime add table trigger_checklist_progress';
  end if;
exception when duplicate_object then null;
end $$;
