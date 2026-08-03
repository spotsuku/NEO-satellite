-- =============================================================================
-- 企業リスト（stakeholders）に「議事録URL」「アクションログ」列を追加（冪等）
--
-- minutes    : 議事録URL。1行に1URL。MTGのたびに追記すると 📄1 📄2 … のリンクになる
-- action_log : アクションログ。実施済みのことを改行で追記していく複数行テキスト
--
-- 実行: Supabase Studio の SQL Editor に貼り付けて Run（2回流しても安全）。
-- =============================================================================

alter table stakeholders add column if not exists minutes text;
alter table stakeholders add column if not exists action_log text;
