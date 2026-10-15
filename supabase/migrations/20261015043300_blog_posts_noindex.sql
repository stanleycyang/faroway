-- Adds a per-post noindex flag. Default false = no behaviour change until code reads it.
alter table public.blog_posts add column if not exists noindex boolean not null default false;
-- Rollback: alter table public.blog_posts drop column noindex;
