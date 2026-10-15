-- Adds a per-post noindex flag. Default false = no behaviour change until code reads it.
alter table public.blog_posts add column if not exists noindex boolean not null default false;

-- Rollback: revert the app that reads `noindex` before dropping the column.
-- Readers retry once when the column is missing, so a drop is tolerated
-- (every post is treated as indexable), but ship the code revert first.
-- alter table public.blog_posts drop column if exists noindex;
