-- =============================================================================
-- オーナー企業 3社体制（1000万円×1口×3社）対応の移行SQL（冪等）
--
-- 1) T6 オーナー候補トップ会談: チェックリストを「1社ずつ」3項目に変更
-- 2) T8 加盟金3000万円達成: 文言を1000万×3口に更新
--    （1社ごとの自動チェック行はアプリ側 v0.11.0 が企業リストから生成）
-- 3) 加盟確定のお祝い: 企業リストでステータスを「確定」にすると
--    「🎉 ◯◯ 加盟確定！（加盟金◯◯万円）」を全員の画面でお祝い表示
--
-- 実行: Supabase Studio の SQL Editor に貼り付けて Run（2回流しても安全）。
-- =============================================================================

-- 1) T6 を3社チェックに
update triggers set
  description = '3社の経営者が出資検討者になる',
  criteria = 'オーナー候補3社（1000万円×1口）それぞれの経営トップとの会談で、出資検討の意思（金額感・社内検討の約束など）が表明される。3社そろった時点で成立。',
  checklist = '["1社目：経営トップと会談し出資意思（1000万×1口）を確認","2社目：経営トップと会談し出資意思を確認","3社目：経営トップと会談し出資意思を確認"]'::jsonb
where code = 'T6';

-- 2) T8 の文言を1000万×3口に + チェックリストをT6と同じ「1社ずつ」形式に
--    （確定合計・期限の自動判定行はアプリ側がこの下に自動表示する）
update triggers set
  description = '立上げ条件クリア（1000万×3口・T1から3ヶ月）',
  criteria = 'ステータス「確定」の加盟金合計が拠点目標（既定3,000万円＝1,000万円×3口）に到達している。1社確定するごとにチェックが埋まる。T1成立から90日以内が期限。到達すると成立提案バナーが出る。',
  checklist = '["1社目：加盟金1000万円（1口）が確定","2社目：加盟金1000万円が確定","3社目：加盟金1000万円が確定"]'::jsonb
where code = 'T8';

-- 3) 加盟確定（ステータス→確定）を1社ずつお祝い
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
    if new_st = '確定' then
      -- 1社ずつのお祝い: 加盟確定は社名＋金額入りの祝いメッセージで全員に演出
      insert into activities(base_id, kind, title, body, is_big, actor_name)
      values (new.base_id, 'status',
              format('🎉 %s 加盟確定！', new.name),
              case when new.commit_amount is not null and new.commit_amount > 0
                   then format('加盟金 %s万円が確定（%s → %s）', new.commit_amount, old_st, new_st)
                   else format('%s → %s', old_st, new_st) end,
              true, new.updated_by);
    else
      is_advance := new_st = '内諾';
      insert into activities(base_id, kind, title, body, is_big, actor_name)
      values (new.base_id, 'status',
              format('%s：%s → %s', new.name, old_st, new_st), null, is_advance, new.updated_by);
    end if;
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
