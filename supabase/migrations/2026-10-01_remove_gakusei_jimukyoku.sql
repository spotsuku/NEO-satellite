-- =============================================================================
-- カテゴリ「学生事務局」を削除（既存データは「事務局」へ統合・冪等）
-- 実行: Supabase Studio の SQL Editor に貼り付けて Run（2回流しても安全）。
-- =============================================================================

alter table stakeholders disable trigger trg_log_stakeholder;
update stakeholders
   set category_id = (select id from categories where name = '事務局')
 where category_id = (select id from categories where name = '学生事務局');
alter table stakeholders enable trigger trg_log_stakeholder;

delete from categories where name = '学生事務局';

update categories set sort = v.s
from (values ('オーナー候補',1),('企業会員候補',2),('教育機関',3),('自治体・メディア',4),('事務局',5),('紹介役',6),('その他',7)) as v(n,s)
where categories.name = v.n;
