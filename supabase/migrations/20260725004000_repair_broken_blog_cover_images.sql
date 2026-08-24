-- Replace cover-image references whose Storage objects no longer exist.
-- Keep finance content visually relevant; use the verified travel fallback
-- for guide/tips content. Both fallback objects are public and present.

UPDATE public.blog_posts
SET cover_image =
  'https://jcnephijkxgtprsutgsf.supabase.co/storage/v1/object/public/images/blog/best-travel-credit-cards-2026-photo-1556742049-0cfed4f6a45d.jpg'
WHERE category = 'Money'
  AND slug IN (
    'chase-offers-amex-offers-maximize-guide',
    'best-credit-cards-food-delivery-uber-eats',
    'credit-card-price-protection-benefit-guide',
    'credit-card-best-practices-avoid-interest',
    'earn-5x-points-everyday-spending-guide',
    'redeem-marriott-bonvoy-points-hotel-stays',
    'amex-membership-rewards-best-transfer-partners',
    'best-credit-card-wallet-strategy-how-many',
    'product-change-credit-card-upgrade-downgrade',
    'credit-card-travel-insurance-benefit-guide',
    'credit-card-cashback-vs-travel-points-value',
    'credit-card-points-free-hotel-nights',
    'credit-card-points-luxury-hotel-stays',
    'earn-1-million-points-in-one-year-strategy',
    'best-credit-cards-small-business-owners',
    'best-credit-cards-gas-travel-rewards-combo',
    'credit-card-application-hard-inquiry-impact'
  );

UPDATE public.blog_posts
SET cover_image =
  'https://jcnephijkxgtprsutgsf.supabase.co/storage/v1/object/public/images/blog/default-photo-1507525428034-b723cf961d3e.jpg'
WHERE category IN ('Guides', 'Tips')
  AND slug IN (
    'japan-travel-tips-first-time-visitor-2025',
    '3-weeks-south-america-itinerary',
    'koh-phi-phi-travel-guide-first-time-visitors',
    'how-to-travel-like-a-local-tips-hacks',
    'how-to-get-local-sim-card-traveling-abroad',
    'cheapest-countries-visit-asia-2025',
    'best-family-friendly-countries-europe',
    'everything-need-know-before-visiting-greece',
    'best-neighborhoods-tbilisi',
    'best-travel-planning-tools-2025',
    'dubrovnik-packing-list',
    'singapore-travel-guide',
    'ai-travel-planner-europe-backpacking',
    'best-places-visit-europe-winter',
    'how-to-deal-with-jet-lag-tips',
    'romantic-travel-destinations-couples-2025',
    '3-days-in-dubrovnik',
    '5-days-in-antigua',
    'kansai-itinerary-10-days-first-time-visitors',
    'best-beach-destinations-families-2025',
    'pai-travel-guide-first-time-visitors',
    '5-days-in-medellin'
  );
