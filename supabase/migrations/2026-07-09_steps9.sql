-- =============================================================================
-- ステップを8個 → 9個に拡張する移行SQL（運用中DB用・冪等）
--
-- 新ステップ3「事務局リーダー確保（地域の旗を振る若手人材）」を挿入し、
-- 旧 T3〜T8（準備室発足〜キックオフ）を T4〜T9 に付け替える。
--
-- trigger_events / trigger_checklist_progress / trigger_notes は
-- triggers.id（uuid）参照のため、コードを付け替えても既存の成立記録・
-- チェック進捗・下書きメモは正しいトリガーに紐づいたまま。
--
-- 実行: Supabase Studio の SQL Editor に貼り付けて Run（2回流しても安全）。
-- =============================================================================

do $$
begin
  -- 既に移行済み（T9が存在）なら何もしない
  if not exists (select 1 from triggers where code = 'T9') then
    -- 後ろから順にコードを付け替え（code の一意制約と衝突しないように）
    update triggers set code = 'T9', sort = 9 where code = 'T8';
    update triggers set code = 'T8', sort = 8 where code = 'T7';
    update triggers set code = 'T7', sort = 7 where code = 'T6';
    update triggers set code = 'T6', sort = 6 where code = 'T5';
    update triggers set code = 'T5', sort = 5 where code = 'T4';
    update triggers set code = 'T4', sort = 4 where code = 'T3';

    -- 新しいステップ3を挿入
    insert into triggers (code, name, description, criteria, checklist, is_clock_start, auto_rule, sort)
    values (
      'T3',
      '事務局リーダー確保',
      '地域の旗を振る若手人材',
      '地域の旗を振る事務局リーダー（若手人材）が決まり、本人が旗振り役を引き受けている。',
      '["地域の旗を振れる若手人材の候補を挙げる","本人と会って構想と役割を共有する","事務局リーダー就任を本人が引き受ける"]'::jsonb,
      false,
      null,
      3
    );
  end if;
end $$;
