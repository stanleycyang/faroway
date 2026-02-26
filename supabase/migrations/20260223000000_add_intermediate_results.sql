-- Column for streaming intermediate agent results to the web SSE endpoint
ALTER TABLE searches ADD COLUMN IF NOT EXISTS intermediate_results JSONB DEFAULT '{}'::jsonb;

-- Atomic merge function (avoids race conditions when parallel agents finish simultaneously)
CREATE OR REPLACE FUNCTION merge_intermediate_results(
  p_search_id UUID, p_key TEXT, p_value JSONB
) RETURNS void AS $$
BEGIN
  UPDATE searches
  SET intermediate_results = COALESCE(intermediate_results, '{}'::jsonb) || jsonb_build_object(p_key, p_value)
  WHERE id = p_search_id;
END;
$$ LANGUAGE plpgsql;
