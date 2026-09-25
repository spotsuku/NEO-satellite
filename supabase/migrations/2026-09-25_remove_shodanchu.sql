-- =============================================================================
-- ステータス「商談中」を削除（既存データは「検討中」へ統合・冪等）
--
-- 1) 商談中のステークホルダーを検討中に付け替え（活動ログのスパムを避けるため
--    ログトリガーを一時停止して実行）
-- 2) statuses から商談中を削除し、sort を振り直し
--
-- 実行: Supabase Studio の SQL Editor に貼り付けて Run（2回流しても安全）。
-- =============================================================================

alter table stakeholders disable trigger trg_log_stakeholder;
update stakeholders
   set status_id = (select id from statuses where name = '検討中')
 where status_id = (select id from statuses where name = '商談中');
alter table stakeholders enable trigger trg_log_stakeholder;

delete from statuses where name = '商談中';

update statuses set sort = v.s
from (values ('未アプローチ',1),('アポ調整中',2),('検討中',3),('内諾',4),('確定',5),('見送り',6)) as v(n,s)
where statuses.name = v.n;
