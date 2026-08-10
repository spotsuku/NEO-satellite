-- =============================================================================
-- 表現統一: 「確保」→「合意」（冪等）
--
-- 1) 準備室ロールの状態値 '確保' を '合意' に変更（制約も付け替え）
--    既存データはそのまま '合意' に引き継がれる
-- 2) T4 準備室発足の成立条件・チェックリストの文言を「〜と合意」に更新
-- 3) 進捗サマリービューの集計条件を '合意' に更新
--
-- 実行: Supabase Studio の SQL Editor に貼り付けて Run（2回流しても安全）。
-- =============================================================================

-- 1) 状態値の付け替え
alter table prep_assignments drop constraint if exists prep_assignments_state_check;
update prep_assignments set state = '合意' where state = '確保';
alter table prep_assignments
  add constraint prep_assignments_state_check check (state in ('未','検討中','合意'));

-- 2) T4 の文言
update triggers set
  criteria = '準備室5ロール（現地紹介者・オーナー企業候補・学生リーダー候補・大学高校関係者・自治体関係者）がすべて「合意」になっている。充足すると成立提案バナーが出るが、確定は人の記録操作。',
  checklist = '["現地紹介者と合意","オーナー企業候補と合意","学生リーダー候補と合意","大学・高校関係者と合意","自治体関係者と合意"]'::jsonb
where code = 'T4';

-- 3) ビューの集計条件
create or replace view v_base_progress as
select b.id as base_id, b.code, b.name, b.goal_amount,
  (select count(*) from trigger_events te where te.base_id = b.id)                       as triggers_done,
  (select count(*) from triggers)                                                        as triggers_total,
  (select count(*) from prep_assignments pa where pa.base_id = b.id and pa.state = '合意') as prep_secured,
  (select count(*) from prep_role_defs)                                                  as prep_total
from bases b where b.is_active;
