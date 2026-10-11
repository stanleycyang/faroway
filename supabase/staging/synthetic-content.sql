-- STAGING-ONLY SYNTHETIC CONTENT. No accounts, real destinations or storage URLs.
INSERT INTO public.destinations(slug,name,country,description,image,tags,currency)
VALUES('fixture-harbor','Fixture Harbor','Testland','Synthetic staging destination; not travel advice.',NULL,ARRAY['fixture'],'USD'),
      ('fixture-garden','Fixture Garden','Testland','Synthetic step-free planning fixture; accessibility is not verified.',NULL,ARRAY['fixture'],'EUR');
INSERT INTO public.blog_posts(slug,title,description,content_source,status,cover_image)
VALUES('fixture-published','Synthetic staging article','Test content, not a published travel recommendation.','database','published',NULL),
      ('fixture-draft','Synthetic private draft','Must not be visible to anonymous readers.','database','draft',NULL);
-- Bucket schema/policies are installed by the historical migration, but no
-- objects or production image URLs are copied. Auth fixtures exist only locally.
